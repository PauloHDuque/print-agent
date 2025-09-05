@echo off
REM Este script desinstala o Servico do Print Agent do Windows.
REM Ele DEVE ser executado como Administrador.

REM ** CORRECAO ADICIONADA AQUI **
REM Muda o diretorio de trabalho para o local onde o script .bat esta.
REM Isso garante que o Node.js encontre o arquivo 'service-uninstall.js'.
cd /d "%~dp0"

echo =================================================
echo    Desinstalando o Servico do Print Agent...
echo =================================================
echo.

REM Executa o script de desinstalacao do Node.js
node service-uninstall.js

echo.
echo =================================================
echo    Servico desinstalado com sucesso!
echo =================================================
echo.
echo Pressione qualquer tecla para fechar esta janela.
pause > nul

