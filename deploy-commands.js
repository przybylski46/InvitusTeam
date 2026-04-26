// =====================
// 🚀 REGISTRAR COMANDOS
// =====================

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log("✅ Comandos registrados");
  } catch (error) {
    console.error(error);
  }
})();
