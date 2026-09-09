import os
import sys

# Extend package __path__ to include backend/app
backend_app_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend', 'app'))
if backend_app_dir not in __path__:
    __path__.append(backend_app_dir)

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend'))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)
