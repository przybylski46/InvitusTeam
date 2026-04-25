const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes, EmbedBuilder } = require('discord.js');
const fs = require('fs');

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

// ===== JSON =====
function loadData() {
  if (!fs.existsSync('reviews.json')) return {};
  return JSON.parse(fs.readFileSync('reviews.json'));
}

function saveData(data) {
  fs.writeFileSync('reviews.json', JSON.stringify(data, null, 2));
}

// ===== COMANDOS =====
const commands = [
  new SlashCommandBuilder()
    .setName('crearperfil')
    .setDescription('Crear perfil de una persona')
    .addStringOption(option =>
      option.setName('persona')
        .setDescription('Nombre')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('reseña')
    .setDescription('Agregar reseña')
    .addStringOption(option =>
      option.setName('persona')
        .setDescription('A quién reseñas')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('calificacion')
        .setDescription('1 a 5')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('comentario')
        .setDescription('Comentario')
        .setRequired(true)
    )
].map(cmd => cmd.toJSON());

// ===== REGISTRAR COMANDOS =====
const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log('Comandos registrados');
  } catch (error) {
    console.error(error);
  }
})();

// ===== BOT LISTO =====
client.once('ready', () => {
  console.log(`Bot listo como ${client.user.tag}`);
});

// ===== INTERACCIONES =====
client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  let data = loadData();

  // ===== CREAR PERFIL =====
  if (interaction.commandName === 'crearperfil') {

    const persona = interaction.options.getString('persona');

    if (data[persona]) {
      return interaction.reply({
        content: "Ese perfil ya existe ❌",
        ephemeral: true
      });
    }

    const embed = new EmbedBuilder()
      .setTitle(`👤 ${persona}`)
      .setDescription("⭐ Promedio: 0\n👥 Total: 0")
      .addFields({
        name: "📝 Reseñas",
        value: "Sin reseñas"
      })
      .setColor(0x5865F2);

    const mensaje = await interaction.channel.send({ embeds: [embed] });

    data[persona] = {
      reviews: [],
      embedId: mensaje.id,
      channelId: mensaje.channel.id
    };

    saveData(data);

    await interaction.reply({
      content: "Perfil creado ✅",
      ephemeral: true
    });
  }

  // ===== RESEÑA =====
  if (interaction.commandName === 'reseña') {

    const persona = interaction.options.getString('persona');
    const calificacion = interaction.options.getInteger('calificacion');
    const comentario = interaction.options.getString('comentario');
    const autor = interaction.user.username;

    if (!data[persona]) {
      return interaction.reply({
        content: "Ese perfil no existe ❌",
        ephemeral: true
      });
    }

    data[persona].reviews.push({
      autor,
      calificacion,
      comentario
    });

    const reviews = data[persona].reviews;

    const promedio = (
      reviews.reduce((a, b) => a + b.calificacion, 0) / reviews.length
    ).toFixed(1);

    const lista = reviews.slice(-5).map(r =>
      `⭐ ${r.calificacion} - ${r.autor}: ${r.comentario}`
    ).join('\n');

    const embed = new EmbedBuilder()
      .setTitle(`👤 ${persona}`)
      .setDescription(`⭐ Promedio: ${promedio}\n👥 Total: ${reviews.length}`)
      .addFields({
        name: "📝 Últimas reseñas",
        value: lista || "Sin reseñas"
      })
      .setColor(0x5865F2);

    const channel = await client.channels.fetch(data[persona].channelId);
    const mensaje = await channel.messages.fetch(data[persona].embedId);

    await mensaje.edit({ embeds: [embed] });

    saveData(data);

    await interaction.reply({
      content: "Reseña agregada ✅",
      ephemeral: true
    });
  }
});

client.login(TOKEN);