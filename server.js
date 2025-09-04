// server.js - A versão definitiva, sem dependências frágeis

const express = require("express");
const cors = require("cors");
const { exec } = require("child_process"); // Módulo nativo do Node.js
const fs = require("fs"); // Módulo nativo para lidar com arquivos
const path = require("path"); // Módulo nativo para lidar com caminhos

const app = express();
const PORT = 9100;

app.use(cors());
app.use(express.json());

// Rota de Status: para verificar se o agent está online
app.get("/status", (req, res) => {
  res.json({
    status: "online",
    message: "Print Agent está rodando de forma estável.",
  });
});

/**
 * Rota para Listar Impressoras usando comandos nativos do SO.
 * Isso elimina a necessidade de bibliotecas com compilação C++.
 */
app.get("/printers", (req, res) => {
  // --- LÓGICA PARA WINDOWS ---
  if (process.platform === "win32") {
    const listPrintersCommand =
      'powershell -command "Get-Printer | Select-Object Name, DriverName, PortName | ConvertTo-Json"';
    const getDefaultPrinterCommand =
      'powershell -command "(Get-Printer | Where-Object IsDefault -eq $true).Name"';

    // 1. Primeiro, executamos o comando para pegar o nome da impressora padrão
    exec(
      getDefaultPrinterCommand,
      (errorDefault, stdoutDefault, stderrDefault) => {
        if (errorDefault) {
          // Não é um erro fatal, apenas logamos. A lista ainda será retornada.
          console.error(
            "Aviso: Não foi possível determinar a impressora padrão.",
            stderrDefault
          );
        }
        // Limpa qualquer espaço em branco ou quebra de linha do resultado
        const defaultPrinterName = stdoutDefault.trim();

        // 2. Agora, executamos o comando para listar todas as impressoras
        exec(listPrintersCommand, (errorList, stdoutList, stderrList) => {
          if (errorList) {
            console.error("Erro ao listar impressoras:", stderrList);
            return res
              .status(500)
              .json({
                error: "Falha ao obter a lista de impressoras.",
                details: stderrList,
              });
          }

          try {
            // O powershell pode retornar um único objeto ou um array, então garantimos que seja sempre um array
            const printers = JSON.parse(
              Array.isArray(JSON.parse(stdoutList))
                ? stdoutList
                : `[${stdoutList}]`
            );

            // 3. Combinamos as informações, marcando a impressora padrão
            const formattedPrinters = printers.map((p) => ({
              name: p.Name,
              driverName: p.DriverName,
              portName: p.PortName,
              isDefault: p.Name === defaultPrinterName,
            }));

            res.json(formattedPrinters);
          } catch (parseError) {
            console.error(
              "Erro ao parsear a lista de impressoras do PowerShell:",
              parseError
            );
            res
              .status(500)
              .json({
                error: "Falha ao interpretar a resposta do sistema.",
                details: stdoutList,
              });
          }
        });
      }
    );

    // --- LÓGICA PARA LINUX e macOS ---
  } else {
    const command = "lpstat -p -d";
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(
          `Erro ao listar impressoras (Linux/macOS): ${error.message}`
        );
        return res
          .status(500)
          .json({
            error: "Falha ao obter a lista de impressoras.",
            details: stderr,
          });
      }

      try {
        const lines = stdout.trim().split("\n");
        let defaultPrinter = "";

        // Encontra a linha que define a impressora padrão do sistema
        const defaultLine = lines.find((line) =>
          line.includes("system default destination:")
        );
        if (defaultLine) {
          defaultPrinter = defaultLine.split(":")[1].trim();
        }

        // Mapeia as linhas que contêm informações das impressoras
        const printers = lines
          .filter((line) => line.startsWith("printer "))
          .map((line) => {
            const name = line.split(" ")[1];
            return {
              name: name,
              driverName: null, // lpstat não fornece essa info facilmente
              portName: null, // lpstat não fornece essa info facilmente
              isDefault: name === defaultPrinter,
            };
          });

        res.json(printers);
      } catch (parseError) {
        console.error("Erro ao parsear a saída do lpstat:", parseError);
        res
          .status(500)
          .json({
            error: "Falha ao interpretar a resposta do sistema.",
            details: stdout,
          });
      }
    });
  }
});

/**
 * Rota para Impressão de Texto Bruto (RAW).
 * Esta rota recebe um texto e o nome da impressora e imprime usando comandos nativos.
 * Perfeito para cupons de texto simples.
 */
app.post("/print/raw-text", (req, res) => {
  const { printerName, text } = req.body;

  if (!printerName || text === undefined) {
    return res
      .status(400)
      .json({ error: 'Os campos "printerName" e "text" são obrigatórios.' });
  }

  // 1. Salva o texto em um arquivo temporário
  const tempFilePath = path.join(__dirname, `print-job-${Date.now()}.txt`);
  fs.writeFile(tempFilePath, text, (err) => {
    if (err) {
      console.error("Erro ao criar arquivo temporário:", err);
      return res
        .status(500)
        .json({ error: "Falha ao preparar dados para impressão." });
    }

    // 2. Monta o comando de impressão nativo
    let printCommand;
    if (process.platform === "win32") {
      // No Windows, o comando 'print' envia o arquivo para a impressora especificada
      printCommand = `print /D:"${printerName}" "${tempFilePath}"`;
    } else {
      // No Linux/macOS, o comando 'lp' faz o mesmo
      printCommand = `lp -d "${printerName}" "${tempFilePath}"`;
    }

    // 3. Executa o comando
    exec(printCommand, (error, stdout, stderr) => {
      // 4. Deleta o arquivo temporário depois de imprimir
      fs.unlink(tempFilePath, (unlinkErr) => {
        if (unlinkErr)
          console.error(
            "Aviso: não foi possível deletar o arquivo temporário:",
            unlinkErr
          );
      });

      if (error) {
        console.error(`Erro ao imprimir: ${error.message}`);
        // Tenta fornecer uma mensagem de erro útil
        let userMessage =
          "Verifique se o nome da impressora está correto e se ela está online.";
        if (stderr.toLowerCase().includes("unable to find printer")) {
          userMessage = `Impressora "${printerName}" não encontrada.`;
        }
        return res.status(500).json({
          error: "Falha ao enviar para a fila de impressão.",
          details: userMessage,
          rawError: stderr,
        });
      }

      res.json({
        success: true,
        message: `Trabalho enviado para a impressora "${printerName}".`,
      });
    });
  });
});

// ===== INICIALIZAÇÃO DO SERVIDOR =====
app.listen(PORT, "localhost", () => {
  console.log(`=================================================`);
  console.log(`✅ Print Agent iniciado no modo estável!`);
  console.log(`👂 Escutando em: http://localhost:${PORT}`);
  console.log(`=================================================`);
});
