// service-install.js - Instala o print-agent.exe como um serviço do Windows

const Service = require("node-windows").Service;
const path = require("path");

// Crie um novo objeto de Serviço
const svc = new Service({
  name: "PrintAgentNodeJS", // O nome do seu serviço
  description:
    "Agente de impressão para conectar sistemas web a impressoras locais.",
  // Caminho para o executável gerado pelo PKG.
  // IMPORTANTE: Este script espera que o .exe esteja na pasta 'dist'.
  script: path.join(__dirname, "server.js"),
  nodeOptions: [], // Deixe vazio pois estamos rodando um .exe, não um script node
});

// Ouça o evento 'install' para saber quando foi concluído
svc.on("install", function () {
  console.log("Serviço instalado com sucesso!");
  console.log("Iniciando o serviço...");
  svc.start();
  console.log("Serviço iniciado.");
});

// Instale o serviço
svc.install();
