@echo off
REM Este script instala o Print Agent como um servico do Windows.
REM Ele DEVE ser executado como Administrador.

REM ** CORRECAO ADICIONADA AQUI **
REM Muda o diretorio de trabalho para o local onde o script .bat esta.
REM Isso garante que o Node.js encontre o arquivo 'service-install.js'.
cd /d "%~dp0"

echo =================================================
echo    Instalando o Servico do Print Agent...
echo =================================================
echo.

REM Executa o script de instalacao do Node.js
node service-install.js

echo.
echo =================================================
echo    Servico instalado e iniciado com sucesso!
echo =================================================
echo.
echo Pressione qualquer tecla para fechar esta janela.
pause > nul

