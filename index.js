const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');
const { AttachmentBuilder } = require('discord.js');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// =====================
// 📦 BASE DE DATOS SIMPLE
// =====================

function loadData() {
  try {
    return JSON.parse(fs.readFileSync('reviews.json', 'utf8'));
  } catch {
    return {};
  }
}

function saveData(data) {
  fs.writeFileSync('reviews.json', JSON.stringify(data, null, 2));
}

// =====================
// ⚙️ COMANDOS
// =====================

const commands = [
  new SlashCommandBuilder()
    .setName('reseña')
    .setDescription('Agregar una reseña')
    .addUserOption(option =>
      option.setName('persona').setDescription('Usuario').setRequired(true))
    .addIntegerOption(option =>
      option.setName('estrellas').setDescription('1 a 5').setRequired(true))
    .addStringOption(option =>
      option.setName('comentario').setDescription('Tu reseña').setRequired(true)),

  new SlashCommandBuilder()
    .setName('setembed')
    .setDescription('Registrar el embed de una persona')
    .addUserOption(option =>
      option.setName('persona').setDescription('Usuario').setRequired(true))
    .addStringOption(option =>
      option.setName('mensaje_id').setDescription('ID del mensaje embed').setRequired(true)),

  new SlashCommandBuilder()
    .setName('crearperfil')
    .setDescription('Crear embed de una persona')
    .addUserOption(option =>
      option.setName('persona')
        .setDescription('Usuario')
        .setRequired(true)),

  new SlashCommandBuilder()
  .setName('info')
  .setDescription('Embed')
  .addStringOption(option =>
    option.setName('nombre')
      .setDescription('Nombre del archivo (sin .json)')
      .setRequired(true))
];

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
    console.log("Comandos registrados");
  } catch (error) {
    console.error(error);
  }
})();

// =====================
// 🤖 BOT LISTO
// =====================

client.once('ready', () => {
  console.log(`Bot listo como ${client.user.tag}`);
});

// =====================
// 💬 INTERACCIONES
// =====================

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  let data = loadData();

  // =====================
  // 🆕 EMBEDS INFO
  // =====================

  if (interaction.commandName === 'info') {

  const nombre = interaction.options.getString('nombre');

  try {
    const perfil = JSON.parse(
      fs.readFileSync(`./Embeds/${nombre}.json`, 'utf8')
    );

    // ⚠️ si usas imágenes tipo attachment://
    const files = [];

    // revisa imágenes automáticamente
    perfil.embeds.forEach(embed => {
      if (embed.image?.url?.startsWith('attachment://')) {
        const fileName = embed.image.url.replace('attachment://', '');
        files.push(new AttachmentBuilder(`./${fileName}`));
      }
    });

    await interaction.channel.send({
      ...perfil,
      files
    });

  } catch (error) {
    console.error(error);

    return interaction.reply({
      content: "❌",
      ephemeral: true
    });
  }
  }
  
  // =====================
  // 🆕 CREAR PERFIL
  // =====================

  if (interaction.commandName === 'crearperfil') {

    const user = interaction.options.getUser('persona');
    const persona = user.id;

    if (data[persona]) {
      return interaction.reply({
        content: "Ese perfil ya existe ❌",
        ephemeral: true
      });
    }

    const mensaje = await interaction.channel.send({
      embeds: [{
        title: `👤 ${user.username}`,
        description: `⭐ Promedio: 0\n👥 Total: 0`,
        fields: [
          {
            name: "📝 Últimas reseñas",
            value: "Sin reseñas"
          }
        ]
      }]
    });

    data[persona] = {
      reviews: [],
      embedId: mensaje.id
    };

    saveData(data);

    return interaction.reply({
      content: `Perfil creado para <@${persona}> ✅`,
      ephemeral: true
    });
  }

  // =====================
  // 🧩 REGISTRAR EMBED
  // =====================

  if (interaction.commandName === 'setembed') {
    const user = interaction.options.getUser('persona');
    const persona = user.id;
    const mensaje_id = interaction.options.getString('mensaje_id');

    if (!data[persona]) data[persona] = { reviews: [], embedId: mensaje_id };
    else data[persona].embedId = mensaje_id;

    saveData(data);

    return interaction.reply({ content: "Embed registrado ✅", ephemeral: true });
  }

  // =====================
  // ⭐ RESEÑA
  // =====================

  if (interaction.commandName === 'reseña') {

    const user = interaction.options.getUser('persona');
    const persona = user.id;

    const estrellas = interaction.options.getInteger('estrellas');
    const comentario = interaction.options.getString('comentario');

    if (estrellas < 1 || estrellas > 5) {
      return interaction.reply({ content: "Pon entre 1 y 5 estrellas", ephemeral: true });
    }

    if (!data[persona]) {
      return interaction.reply({ content: "Esa persona no tiene embed registrado", ephemeral: true });
    }

    data[persona].reviews = data[persona].reviews.filter(r => r.user !== interaction.user.id);

    data[persona].reviews.push({
      user: interaction.user.id,
      name: interaction.user.username,
      estrellas,
      comentario
    });

    saveData(data);

    let reviews = data[persona].reviews;

    let total = reviews.reduce((acc, r) => acc + r.estrellas, 0);
    let promedio = (total / reviews.length).toFixed(1);

    let ultimas = reviews.slice(-10).map(r =>
      `⭐ ${r.estrellas} - ${r.name}: ${r.comentario}`
    ).join("\n");

    try {
      const canal = interaction.channel;
      const mensaje = await canal.messages.fetch(data[persona].embedId);

      await mensaje.edit({
        embeds: [{
          title: `👤 ${user.username}`,
          description: `⭐ Promedio: ${promedio}\n👥 Total: ${reviews.length}`,
          fields: [
            {
              name: "📝 Últimas reseñas",
              value: ultimas || "Sin reseñas"
            }
          ]
        }]
      });

    } catch (error) {
      console.error(error);
    }

    return interaction.reply({ content: "Reseña guardada ⭐", ephemeral: true });
  }

});

client.login(TOKEN);
