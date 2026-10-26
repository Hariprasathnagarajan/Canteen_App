from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse


def root_health_view(request):
    """Health check endpoint for Render and root URL visits"""
    return JsonResponse({
        'status': 'online',
        'message': 'VDart Cafe — Canteen Management System API is running',
        'backend': 'https://canteen-app-l261.onrender.com',
        'frontend': 'https://vcafe.netlify.app',
        'endpoints': {
            'api': '/api/',
            'admin': '/admin/',
            'csrf': '/api/csrf/',
            'login': '/api/login/',
        }
    })


urlpatterns = [
    # Root health check endpoint (returns 200 OK for Render health checks and root visits)
    path('', root_health_view, name='root_health'),
    
    # Django Admin
    path('admin/', admin.site.urls),
    
    # Primary API routes.
    # The API is registered ONCE. It used to be registered a second time at the
    # root as a "fallback", which exposed every endpoint (including the
    # anonymous password-reset views) at two paths and doubled the attack
    # surface. The frontend always uses the /api prefix.
    path('api/', include('api.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
