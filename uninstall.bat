@echo off
:: ##################################################################
:: #      Desinstalador do Print Agent (Versao Final com NSSM)      #
:: #      + Automacao de Regra de Firewall                          #
:: ##################################################################

:: --- Verifica se esta rodando como Administrador ---
net session >nul 2>&1
if %errorLevel% == 0 (
  echo Privilegios de Administrador OK.
) else (
  echo ERRO: Execute este arquivo como Administrador.
  pause
  exit
)

:: --- Variavel de configuracao ---
SET "SERVICENAME=PrintAgentNodeJS"
SET "NSSMPATH=%~dp0nssm.exe"

echo.
echo Parando o servico...
"%NSSMPATH%" stop %SERVICENAME%

echo.
echo Removendo o servico...
"%NSSMPATH%" remove %SERVICENAME% confirm

:: ##############################################################
:: #                 NOVA SECAO: REGRA DE FIREWALL                #
:: ##############################################################
echo.
echo Removendo regra do Firewall...
powershell -ExecutionPolicy Bypass -Command "Remove-NetFirewallRule -DisplayName 'Print Agent (Porta 9100)' -ErrorAction SilentlyContinue"
echo    - Regra do Firewall removida (se existia).

echo.
echo =========================================================
echo  DESINSTALACAO CONCLUIDA!
echo =========================================================
pause