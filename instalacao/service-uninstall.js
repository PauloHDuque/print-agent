// service-uninstall.js - Remove o serviço do PrintAgent do Windows

const Service = require("node-windows").Service;
const path = require("path");

// Configure os detalhes do serviço para encontrá-lo e removê-lo.
// É crucial que o 'name' e o 'script' sejam os mesmos usados na instalação.
const svc = new Service({
  name: "PrintAgentNodeJS",
  script: path.join(__dirname, "server.js"),
});

// Ouça o evento 'uninstall' para fornecer feedback ao usuário.
svc.on("uninstall", function () {
  console.log("Serviço desinstalado com sucesso.");
  console.log("O serviço não existe mais no sistema.");
});

// Desinstale o serviço.
svc.uninstall();
