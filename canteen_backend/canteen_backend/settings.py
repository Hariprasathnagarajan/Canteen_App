import os
from pathlib import Path
from decouple import config
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = config('SECRET_KEY', default='django-insecure-canteen-app-production-secret-key-change-me')
DEBUG = config('DEBUG', default=True, cast=bool)

# Hosts configuration
allowed_hosts_env = config(
    'ALLOWED_HOSTS',
    default='localhost,127.0.0.1,0.0.0.0,canteen-app-l261.onrender.com,.onrender.com'
)
ALLOWED_HOSTS = [h.strip() for h in allowed_hosts_env.split(',') if h.strip()]

# Render proxy support: Render terminates SSL and forwards via HTTP with X-Forwarded-Proto: https
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'api',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'canteen_backend.urls'

# CORS settings
cors_origins_env = config(
    'CORS_ALLOWED_ORIGINS',
    default='https://vcafe.netlify.app,http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173'
)
CORS_ALLOWED_ORIGINS = [o.strip() for o in cors_origins_env.split(',') if o.strip()]
for origin in ['https://vcafe.netlify.app', 'https://canteen-app-l261.onrender.com']:
    if origin not in CORS_ALLOWED_ORIGINS:
        CORS_ALLOWED_ORIGINS.append(origin)

# Regex to allow all Netlify and Render preview/production subdomains
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https:\/\/.*\.netlify\.app$",
    r"^https:\/\/.*\.onrender\.com$",
]

CORS_ALLOW_CREDENTIALS = True
CORS_EXPOSE_HEADERS = ['Content-Type', 'X-CSRFToken']
CORS_ALLOW_HEADERS = [
    'accept',
    'accept-encoding',
    'authorization',
    'content-type',
    'dnt',
    'origin',
    'user-agent',
    'x-csrftoken',
    'x-requested-with',
]

# CSRF settings
csrf_origins_env = config(
    'CSRF_TRUSTED_ORIGINS',
    default='https://vcafe.netlify.app,https://canteen-app-l261.onrender.com,http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173'
)
CSRF_TRUSTED_ORIGINS = [o.strip() for o in csrf_origins_env.split(',') if o.strip()]
for wildcard_trusted in ['https://vcafe.netlify.app', 'https://canteen-app-l261.onrender.com', 'https://*.netlify.app', 'https://*.onrender.com']:
    if wildcard_trusted not in CSRF_TRUSTED_ORIGINS:
        CSRF_TRUSTED_ORIGINS.append(wildcard_trusted)

# Cookie & Session settings for cross-site requests (Netlify <-> Render)
# When deployed across domains (e.g. netlify.app -> onrender.com) over HTTPS,
# SameSite must be 'None' and Secure must be True.
IS_PRODUCTION = config('ENVIRONMENT', default='development').lower() == 'production' or not DEBUG

SESSION_COOKIE_NAME = 'sessionid'
SESSION_COOKIE_AGE = 1209600  # 2 weeks
SESSION_COOKIE_DOMAIN = config('SESSION_COOKIE_DOMAIN', default=None)
SESSION_COOKIE_PATH = '/'
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SECURE = config('SESSION_COOKIE_SECURE', default=IS_PRODUCTION, cast=bool)
SESSION_COOKIE_SAMESITE = 'None' if SESSION_COOKIE_SECURE else 'Lax'

CSRF_COOKIE_NAME = 'csrftoken'
CSRF_COOKIE_AGE = 31449600  # 1 year
CSRF_COOKIE_DOMAIN = config('CSRF_COOKIE_DOMAIN', default=None)
CSRF_COOKIE_PATH = '/'
CSRF_COOKIE_HTTPONLY = False  # Frontend needs to read csrftoken for X-CSRFToken header
CSRF_COOKIE_SECURE = config('CSRF_COOKIE_SECURE', default=IS_PRODUCTION, cast=bool)
CSRF_COOKIE_SAMESITE = 'None' if CSRF_COOKIE_SECURE else 'Lax'
CSRF_USE_SESSIONS = False

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

# Database configuration (supports Render PostgreSQL via DATABASE_URL or SQLite default)
database_url = config('DATABASE_URL', default=None)
if database_url:
    DATABASES = {
        'default': dj_database_url.config(
            default=database_url,
            conn_max_age=600,
            conn_health_checks=True,
        )
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }

AUTH_USER_MODEL = 'api.CustomUser'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files & Media (with WhiteNoise for production)
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
