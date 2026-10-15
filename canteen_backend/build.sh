#!/usr/bin/env bash
# Exit immediately if a command exits with a non-zero status
set -o errexit

echo ">>> Installing Python dependencies..."
pip install -r requirements.txt

echo ">>> Running database migrations..."
python manage.py migrate

echo ">>> Collecting static files..."
python manage.py collectstatic --no-input

echo ">>> Seeding initial data (admin, users, menu items)..."
python seed_data.py

echo ">>> Build completed successfully!"
