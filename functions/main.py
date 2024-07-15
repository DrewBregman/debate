import functions_framework
from app import app

@functions_framework.http
def app_func(request):
    with app.request_context(request.environ):
        return app.full_dispatch_request()
