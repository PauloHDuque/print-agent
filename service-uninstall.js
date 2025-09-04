// service-uninstall.js
const Service = require("node-windows").Service;
const path = require("path");

// Crie um objeto de Serviço apontando para o seu script
const svc = new Service({
  name: "PrintAgentNodeJS",
  script: path.join(__dirname, "server.js"),
});

// Ouça o evento 'uninstall'
svc.on("uninstall", function () {
  console.log("Serviço desinstalado com sucesso.");
  console.log("O serviço não existe mais.");
});

// Desinstale o serviço
svc.uninstall();
