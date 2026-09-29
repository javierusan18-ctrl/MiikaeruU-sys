@echo off
REM Modo diagnostico: muestra la consola con el detalle tecnico (logs, errores).
REM Para uso normal, usa el acceso directo "Miikaeru IA" o Iniciar_Miikaeru_IA.vbs.
title Miikaeru - Generador de Video con IA (modo consola)
"C:\Users\PC\AppData\Local\Programs\Python310-embed\python.exe" "%~dp0webapp.py" --cpu
pause
