' Lanzador de la interfaz web de Miikaeru (SadTalker + Cuerpo Completo)
' Arranca el servidor sin mostrar ninguna ventana de consola y abre el
' navegador automaticamente. Si ya esta corriendo, solo abre el navegador.

Dim fso, shell, http
Dim scriptDir, pythonExe, appScript, logDir, urlBase

Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
pythonExe = "C:\Users\PC\AppData\Local\Programs\Python310-embed\pythonw.exe"
appScript = scriptDir & "\webapp.py"
logDir = scriptDir & "\logs"
urlBase = "http://127.0.0.1:7860/"

If Not fso.FolderExists(logDir) Then
    fso.CreateFolder(logDir)
End If

Function ServidorActivo(url)
    Dim req
    On Error Resume Next
    Set req = CreateObject("MSXML2.XMLHTTP")
    req.Open "GET", url, False
    req.Send
    If Err.Number = 0 And req.Status = 200 Then
        ServidorActivo = True
    Else
        ServidorActivo = False
    End If
    On Error Goto 0
End Function

If ServidorActivo(urlBase) Then
    ' Ya esta corriendo: solo abrir el navegador.
    shell.Run urlBase, 1, False
    WScript.Quit
End If

If Not fso.FileExists(pythonExe) Then
    MsgBox "No se encontro Python en:" & vbCrLf & pythonExe & vbCrLf & vbCrLf & _
           "Vuelve a ejecutar la instalacion del entorno antes de usar este acceso directo.", _
           vbCritical, "Miikaeru - Generador de Video con IA"
    WScript.Quit
End If

shell.CurrentDirectory = scriptDir
shell.Run """" & pythonExe & """ """ & appScript & """", 0, False

' El navegador se abre solo desde Python (inbrowser=True) apenas el servidor
' este listo. Esperamos y verificamos que realmente haya arrancado bien.
WScript.Sleep 45000

If Not ServidorActivo(urlBase) Then
    MsgBox "La interfaz esta tardando mas de lo normal en iniciar, o algo fallo." & vbCrLf & vbCrLf & _
           "Revisa el archivo de registro para mas detalles:" & vbCrLf & logDir & "\webapp.log" & vbCrLf & vbCrLf & _
           "Si el problema persiste, intenta cerrar cualquier ventana anterior de Miikaeru y prueba de nuevo.", _
           vbExclamation, "Miikaeru - Generador de Video con IA"
End If
