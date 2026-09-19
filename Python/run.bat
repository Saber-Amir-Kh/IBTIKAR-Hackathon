@echo off
cd /d "%~dp0"
echo Starting Algeria Wildfire AI Microservice on Port 8000...
if not exist "venv\Scripts\python.exe" (
    echo Virtual environment not found. Creating venv...
    python -m venv venv
    call venv\Scripts\activate.bat
    pip install -r requirements.txt
) else (
    call venv\Scripts\activate.bat
)
python main.py
