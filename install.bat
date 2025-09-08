@echo off
:: ###############################################################
:: #      Instalador do Print Agent (Versao Final com NSSM)      #
:: #      + Automacao de Regra de Firewall                      #
:: ###############################################################

:: --- Verifica se esta rodando como Administrador ---
net session >nul 2>&1
if %errorLevel% == 0 (
  echo Privilegios de Administrador OK.
) else (
  echo ERRO: Execute este arquivo como Administrador.
  pause
  exit
)

:: --- Variaveis de configuracao ---
SET "SERVICENAME=PrintAgentNodeJS"
SET "DISPLAYNAME=Print Agent (Servico de Impressao)"
SET "EXEPATH=%~dp0dist\print-agent.exe"
SET "NSSMPATH=%~dp0nssm.exe"

echo.
echo Instalando o servico com NSSM...
"%NSSMPATH%" install %SERVICENAME% "%EXEPATH%"

echo.
echo Configurando o nome de exibicao do servico...
"%NSSMPATH%" set %SERVICENAME% DisplayName "%DISPLAYNAME%"

echo.
echo Configurando o servico para iniciar automaticamente...
"%NSSMPATH%" set %SERVICENAME% Start SERVICE_AUTO_START

:: ##############################################################
:: #                 NOVA SECAO: REGRA DE FIREWALL                #
:: ##############################################################
echo.
echo Criando regra no Firewall do Windows para a porta 9100...
powershell -ExecutionPolicy Bypass -Command "New-NetFirewallRule -DisplayName 'Print Agent (Porta 9100)' -Direction Inbound -Protocol TCP -LocalPort 9100 -Action Allow -ErrorAction SilentlyContinue"
echo    - Regra do Firewall configurada.

echo.
echo Iniciando o servico...
"%NSSMPATH%" start %SERVICENAME%

echo.
echo =========================================================
echo  INSTALACAO CONCLUIDA COM SUCESSO!
echo =========================================================
echo O servico foi instalado e iniciado com sucesso.
echo.
pause