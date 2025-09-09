const express = require("express");
const cors = require("cors");
const { exec } = require("child_process");
const escpos = require("escpos");
escpos.USB = require("escpos-usb");

const app = express();
const PORT = 9100;

app.use(express.json({ limit: "5mb" }));
app.use(cors());

// ROTA DE STATUS - Para verificar se o agente está online
app.get("/status", (req, res) => {
  res.json({
    status: "online",
    message: "Print Agent (Modo Inteligente) está rodando.",
  });
});

// ROTA PARA LISTAR IMPRESSORAS DO WINDOWS (Útil para a versão WEB)
app.get("/printers", (req, res) => {
  if (process.platform !== "win32") {
    return res
      .status(501)
      .json({ error: "Endpoint implementado apenas para Windows." });
  }
  const command =
    'powershell -command "Get-WmiObject -Class Win32_Printer | Select-Object Name, DriverName, PortName, Default | ConvertTo-Json"';
  exec(command, (error, stdout, stderr) => {
    if (error || stderr)
      return res.status(500).json({
        error: "Falha ao obter lista de impressoras.",
        details: stderr || error.message,
      });
    try {
      const printersRaw = JSON.parse(stdout);
      const printers = Array.isArray(printersRaw) ? printersRaw : [printersRaw];
      const formattedPrinters = printers.map((p) => ({
        name: p.Name || p.DriverName,
        driverName: p.DriverName,
        portName: p.PortName,
        isDefault: p.Default,
      }));
      res.json(formattedPrinters);
    } catch (parseError) {
      res.status(500).json({
        error: "Falha ao interpretar a resposta do sistema.",
        details: stdout,
      });
    }
  });
});

// ROTA PRINCIPAL PARA IMPRESSÃO DE CUPONS (WEB E MOBILE)
// Recebe dados em JSON e usa ESC/POS para formatação e corte.
app.post("/print/formatted-receipt", (req, res) => {
  try {
    const device = new escpos.USB();
    const printer = new escpos.Printer(device);
    const data = req.body.data;

    if (!data) {
      return res.status(400).json({
        error: "O corpo da requisição precisa conter um objeto 'data'.",
      });
    }

    device.open((error) => {
      if (error) {
        console.error("Erro ao conectar na impressora USB:", error);
        return res.status(500).json({
          error: "Falha ao conectar com a impressora USB.",
          details: error.message,
        });
      }

      const LARGURA = data.lineWidth || 48; // Pega a largura do front-end, ou usa 48 como padrão
      const separador = "-".repeat(LARGURA);
      const centralizar = (texto) =>
        String(texto || "")
          .padStart(Math.floor((LARGURA + String(texto || "").length) / 2), " ")
          .padEnd(LARGURA, " ");

      printer
        .font("a")
        .align("ct")
        .style("b")
        .size(1, 1)
        .text(data.empresa.fantasia)
        .style("normal")
        .size(0, 0)
        .text(centralizar(`CNPJ: ${data.empresa.cnpj}`))
        .text(separador)
        .text(centralizar(`COMANDA: ${data.numero}`))
        .align("lt")
        .text(`Cliente: ${data.cliente || "Nao informado"}`)
        .text(
          `Data: ${new Date(data.createdAt).toLocaleString("pt-BR", {
            timeZone: "America/Sao_Paulo",
          })}`
        )
        .text(separador);

      (data.ItemComandas || []).forEach((item) => {
        const totalLinha = (
          parseFloat(item.quantidade) * parseFloat(item.valor_unitario)
        ).toFixed(2);
        const nomeItem = `${item.quantidade}x ${item.produto.nome}`.substring(
          0,
          LARGURA - 12
        );
        const linha = `${nomeItem.padEnd(
          LARGURA - 12,
          " "
        )} R$${totalLinha.padStart(9, " ")}`;
        printer.text(linha);
      });

      printer.text(separador);
      const total = (data.ItemComandas || []).reduce(
        (acc, item) =>
          acc + parseFloat(item.quantidade) * parseFloat(item.valor_unitario),
        0
      );
      printer
        .align("rt")
        .style("b")
        .size(0, 1)
        .text(`TOTAL: R$ ${total.toFixed(2)}`);

      printer
        .align("ct")
        .style("normal")
        .size(0, 0)
        .feed(2)
        .text("Obrigado pela preferência!")
        .feed(3)
        .cut()
        .close();

      res.json({
        success: true,
        message: "Cupom formatado enviado para a impressora.",
      });
    });
  } catch (err) {
    console.error("Erro durante a impressão ESC/POS:", err);
    res.status(500).json({
      error: "Ocorreu um erro ao tentar imprimir.",
      details: err.message,
    });
  }
});

// INICIALIZAÇÃO DO SERVIDOR
app.listen(PORT, "0.0.0.0", () => {
  console.log(`=================================================`);
  console.log(`✅ Print Agent (Modo Inteligente) iniciado!`);
  console.log(`👂 Escutando em: http://localhost:${PORT} e na sua rede local.`);
  console.log(`=================================================`);
});
