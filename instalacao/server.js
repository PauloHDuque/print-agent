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
 * Rota para Listar Impressoras (VERSÃO ESTÁVEL e MULTIPLATAFORMA)
 * Usa o comando WMIC (Windows) ou lpstat (Linux/macOS) para obter
 * a lista de impressoras em tempo real.
 */
app.get("/printers", (req, res) => {
  // --- LÓGICA PARA WINDOWS ---
  if (process.platform === "win32") {
    const command = "wmic printer get Name,DriverName,Default /format:csv";

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error("Erro ao executar WMIC:", error);
        return res.status(500).json({
          error: "Falha crítica ao consultar impressoras via WMIC.",
          details: stderr,
        });
      }
      try {
        const lines = stdout
          .trim()
          .split("\r\n")
          .filter((line) => line.length > 0);
        if (lines.length <= 1) {
          return res.json([]);
        }

        const headers = lines[0].split(",");
        const printerData = lines.slice(1);
        const nameIndex = headers.indexOf("Name");
        const driverIndex = headers.indexOf("DriverName");
        const defaultIndex = headers.indexOf("Default");

        const printers = printerData.map((line) => {
          const columns = line.split(",");
          return {
            name: columns[nameIndex] || null,
            driverName: columns[driverIndex] || null,
            isDefault: columns[defaultIndex]
              ? columns[defaultIndex].toUpperCase() === "TRUE"
              : false,
          };
        });
        res.json(printers);
      } catch (parseError) {
        console.error("Erro ao parsear a saída do WMIC:", parseError);
        res.status(500).json({
          error: "Falha ao interpretar a resposta do sistema via WMIC.",
          details: stdout,
        });
      }
    });
    // --- LÓGICA PARA LINUX e macOS ---
  } else {
    const command = "lpstat -p -d";
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(
          `Erro ao listar impressoras (Linux/macOS): ${error.message}`
        );
        return res.status(500).json({
          error: "Falha ao obter a lista de impressoras.",
          details: stderr,
        });
      }
      try {
        const lines = stdout.trim().split("\n");
        let defaultPrinter = "";
        const defaultLine = lines.find((line) =>
          line.includes("system default destination:")
        );
        if (defaultLine) {
          defaultPrinter = defaultLine.split(":")[1].trim();
        }

        const printers = lines
          .filter((line) => line.startsWith("printer "))
          .map((line) => {
            const name = line.split(" ")[1];
            return {
              name: name,
              driverName: null, // lpstat não fornece essa info facilmente
              isDefault: name === defaultPrinter,
            };
          });
        res.json(printers);
      } catch (parseError) {
        console.error("Erro ao parsear a saída do lpstat:", parseError);
        res.status(500).json({
          error: "Falha ao interpretar a resposta do sistema (lpstat).",
          details: stdout,
        });
      }
    });
  }
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
        res
          .status(500)
          .json({
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
