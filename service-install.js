// service-install.js
const Service = require("node-windows").Service;
const path = require("path");

// Crie um novo objeto de Serviço
const svc = new Service({
  name: "PrintAgentNodeJS", // Nome que aparecerá nos Serviços do Windows
  description: "Agente em Node.js para fazer a ponte de impressão web/local.",
  // Caminho completo para o seu script principal
  script: path.join(__dirname, "server.js"),
});

// Ouça o evento 'install' para saber quando foi concluído
svc.on("install", function () {
  console.log("Serviço instalado com sucesso!");
  console.log("Para iniciar o serviço, execute: net start PrintAgentNodeJS");
  svc.start();
});

// Instale o serviço
svc.install();
