import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials, auth
from functools import wraps
import anthropic
from dotenv import load_dotenv
import logging

# Conditional import for Firebase Functions
is_firebase = os.getenv('FIREBASE_CONFIG') is not None
if is_firebase:
    from firebase_functions import https_fn

logging.basicConfig(level=logging.DEBUG)

load_dotenv()
app = Flask(__name__, static_folder='public', static_url_path='')
CORS(app)

api_key = os.environ.get("ANTHROPIC_API_KEY")
client = anthropic.Anthropic(api_key=api_key)

# Initialize Firebase app only if not running locally
if is_firebase:
    firebase_admin.initialize_app()
else:
    # For local development, you might want to use a service account key
    # Uncomment and adjust the path as necessary
    cred = credentials.Certificate("serviceAccountKey.json")
    firebase_admin.initialize_app(cred)
    pass

def check_token(f):
    @wraps(f)
    def wrap(*args, **kwargs):
        if not is_firebase:
            # Skip token check for local development
            return f(*args, **kwargs)
        
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return jsonify({'message': 'No token provided'}), 400
        try:
            token = auth_header.split(' ')[1]
            user = auth.verify_id_token(token)
            request.user = user
        except (auth.InvalidIdTokenError, IndexError):
            return jsonify({'message': 'Invalid token provided'}), 401
        except auth.ExpiredIdTokenError:
            return jsonify({'message': 'Expired token provided'}), 401
        except Exception as e:
            return jsonify({'message': f'Token verification error: {str(e)}'}), 400
        return f(*args, **kwargs)
    return wrap

@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/app')
def serve_app():
    return send_from_directory(app.static_folder, 'app.html')

@app.route('/<path:path>')
def serve_static(path):
    if os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return "File not found", 404

@app.route('/firebaseConfig.js')
def serve_firebase_config():
    return send_from_directory(app.static_folder, 'firebaseConfig.js')

@app.route('/debate', methods=['POST'])
@check_token
def debate():
    try:
        logging.debug(f"Received headers: {request.headers}")
        logging.debug(f"Received data: {request.get_data()}")
        user_input = request.json.get('input')
        conversation = request.json.get('conversation', [])

        system_message = """
        You are an AI debate master, adept in intellectual discourse and pedagogy through debate. Your mission is to engage users in stimulating debates while imparting knowledge on various subjects. Follow these guidelines:

        1. Deliver concise yet insightful responses, focusing on key points and arguments.
        2. Use dense, information-rich language, avoiding unnecessary descriptors or filler words.
        3. Maintain a conversational tone, using phrases like "I believe" and "I think."
        4. Provide brief explanations of your arguments, focusing on the most compelling points.
        5. Define complex terms succinctly and use concise examples to support your arguments.
        6. Frequently disagree and rebut arguments, embodying the role of devil's advocate.
        7. Present logical counterarguments efficiently, identifying core flaws in opposing viewpoints.
        8. Stimulate critical thinking by posing challenging questions.
        9. Keep responses brief, ideally under 100 words, to maintain a dynamic conversation flow.

        Your objective is to challenge the user's thinking and broaden their perspective through quick, engaging exchanges. Aim for a rapid-fire debate style that keeps the conversation lively and thought-provoking.
        """

        messages = [msg for msg in conversation if msg['role'] != 'system']
        messages.append({"role": "user", "content": user_input})

        response = client.messages.create(
            model="claude-3-5-sonnet-20240620",
            max_tokens=1000,
            temperature=0.7,
            system=system_message,
            messages=messages
        )
        bot_response = response.content[0].text
        return jsonify({'response': bot_response})
    except Exception as e:
        logging.error(f"Error in debate function: {e}")
        return jsonify({'error': str(e)}), 500

if is_firebase:
    @https_fn.on_request()
    def app_func(req: https_fn.Request) -> https_fn.Response:
        with app.request_context(req.environ):
            return app.full_dispatch_request()

if __name__ == '__main__':
    app.run(debug=True)