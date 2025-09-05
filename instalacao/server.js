// server.js - Versão final, completa, autocontida e multiplataforma.

const express = require("express");
const cors = require("cors");
// Importamos tanto 'exec' (para comandos simples) quanto 'spawn' (para comandos complexos)
const { exec, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 9100;

app.use(cors());
app.use(express.json());

// Rota de Status: para verificar se o agent está online
app.get("/status", (req, res) => {
  res.json({
    status: "online",
    message: "Print Agent está rodando.",
  });
});

/**
 * Rota para Listar Impressoras (VERSÃO DEFINITIVA E MAIS ROBUSTA)
 * Usa um único comando WMI via PowerShell, que é mais compatível e confiável
 * para obter todos os dados necessários (Name, DriverName, Default) de uma só vez,
 * já no formato JSON, evitando erros de interpretação de texto.
 */
app.get("/printers", (req, res) => {
  // Implementado apenas para Windows
  if (process.platform !== "win32") {
    return res
      .status(501)
      .json({ error: "Endpoint implementado apenas para Windows." });
  }

  // Comando único e confiável que busca tudo que precisamos e já converte para JSON
  const command =
    'powershell -command "Get-WmiObject -Class Win32_Printer | Select-Object Name, DriverName, PortName, Default | ConvertTo-Json"';

  exec(command, (error, stdout, stderr) => {
    if (error || stderr) {
      console.error(
        "Erro ao executar PowerShell/WMI:",
        stderr || error.message
      );
      return res.status(500).json({
        error: "Falha ao obter a lista de impressoras.",
        details: stderr,
      });
    }

    try {
      // O PowerShell pode retornar um único objeto se houver apenas uma impressora,
      // então garantimos que o resultado seja sempre um array para o .map() funcionar.
      const printersRaw = JSON.parse(stdout);
      const printers = Array.isArray(printersRaw) ? printersRaw : [printersRaw];

      const formattedPrinters = printers.map((p) => {
        // Lógica de fallback para garantir que o 'name' nunca seja nulo
        const reliableName = p.Name || p.DriverName;

        return {
          name: reliableName,
          driverName: p.DriverName,
          portName: p.PortName,
          // A propriedade 'Default' do WMI já é um booleano (true/false), então não precisa de conversão
          isDefault: p.Default,
        };
      });

      res.json(formattedPrinters);
    } catch (parseError) {
      console.error(
        "Erro ao interpretar a resposta JSON do PowerShell:",
        parseError
      );
      res.status(500).json({
        error: "Falha ao interpretar a resposta do sistema.",
        details: stdout,
      });
    }
  });
});

/**
 * Rota de Impressão (VERSÃO FINAL NATIVA)
 * Combina a criação de um arquivo temporário com a execução via 'spawn'
 * para replicar o comando manual que funcionou.
 */
app.post("/print/raw-text", (req, res) => {
  const { printerName, text } = req.body;

  if (!printerName || text === undefined) {
    return res
      .status(400)
      .json({ error: 'Os campos "printerName" e "text" são obrigatórios.' });
  }

  const tempFilePath = path.join(__dirname, `print-job-${Date.now()}.txt`);

  // 1. Voltamos a criar o arquivo temporário.
  fs.writeFile(tempFilePath, text, { encoding: "latin1" }, (err) => {
    if (err) {
      console.error("Erro ao criar arquivo temporário:", err);
      return res
        .status(500)
        .json({ error: "Falha ao preparar dados para impressão." });
    }

    // 2. Montamos o comando EXATO que funcionou no teste manual.
    const command = `Get-Content -Path '${tempFilePath}' | Out-Printer -Name '${printerName}'`;

    // 3. Usamos spawn para executá-lo de forma robusta.
    const ps = spawn("powershell", [
      "-ExecutionPolicy",
      "Bypass",
      "-NoProfile",
      "-Command",
      command,
    ]);

    let stderr = "";

    ps.stderr.on("data", (data) => {
      console.error(`PowerShell Stderr: ${data}`);
      stderr += data;
    });

    ps.on("close", (code) => {
      console.log(`Processo do PowerShell finalizado com código: ${code}`);

      // 4. Deletamos o arquivo temporário após a conclusão.
      fs.unlink(tempFilePath, () => {});

      if (code === 0) {
        res.json({
          success: true,
          message: `Trabalho (com arquivo) enviado via spawn para a impressora "${printerName}".`,
        });
      } else {
        res.status(500).json({
          error:
            "Falha ao executar o processo de impressão (com arquivo) via spawn.",
          details: stderr,
        });
      }
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
