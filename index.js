// =====================
// 🌐 SERVIDOR WEB (WAKE)
// =====================

const PORT = process.env.PORT || 3000;

require('http').createServer((req, res) => {
  res.end('Bot activo');
}).listen(PORT, () => {
  console.log("🌐 web activo");
});

// =====================
// 🤖 BOT
// =====================

const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');
const fs = require('fs');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// =====================
// 📦 BASE DE DATOS
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

let data = loadData();

let saveTimeout;
function saveLater() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveData(data);
    console.log("💾 Guardado");
  }, 5000);
}

// =====================
// 🎮 ROBLOX + CACHE
// =====================

const avatarCache = new Map();
const CACHE_TIME = 1000 * 60 * 10;

async function getRobloxId(username) {
  const res = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usernames: [username] })
  });

  const data = await res.json();
  return data.data[0]?.id;
}

async function getRobloxAvatar(userId) {
  const now = Date.now();

  if (avatarCache.has(userId)) {
    const cached = avatarCache.get(userId);
    if (now - cached.timestamp < CACHE_TIME) {
      return cached.url;
    }
  }

  const res = await fetch(
    `https://thumbnails.roblox.com/v1/users/avatar-body?userIds=${userId}&size=720x720&format=Png`
  );

  const data = await res.json();
  const url = data.data[0]?.imageUrl;

  avatarCache.set(userId, { url, timestamp: now });

  return url;
}

// =====================
// 🔄 ACTUALIZAR EMBED
// =====================

async function actualizarMensajeDesdeJSON(client, nombre) {
  const path = `./Embeds/${nombre}.json`;
  const perfil = JSON.parse(fs.readFileSync(path, 'utf8'));

  if (!perfil.channelId || !perfil.embedId) return;

  try {
    const canal = await client.channels.fetch(perfil.channelId);
    const mensaje = await canal.messages.fetch(perfil.embedId);

    await mensaje.edit({
      embeds: perfil.embeds
    });

  } catch {
    console.log("❌ No se pudo actualizar el mensaje");
  }
}

// =====================
// ⚙️ COMANDOS
// =====================

const commands = [
  new SlashCommandBuilder()
    .setName('reseña')
    .setDescription('Agregar una reseña')
    .addUserOption(option =>
      option.setName('persona').setRequired(true))
    .addIntegerOption(option =>
      option.setName('estrellas').setRequired(true))
    .addStringOption(option =>
      option.setName('comentario').setRequired(true)),

  new SlashCommandBuilder()
    .setName('setembed')
    .setDescription('Registrar embed manualmente')
    .addUserOption(option =>
      option.setName('persona').setRequired(true))
    .addStringOption(option =>
      option.setName('mensaje_id').setRequired(true)),

  new SlashCommandBuilder()
    .setName('crearperfil')
    .setDescription('Crear perfil de reseñas')
    .addUserOption(option =>
      option.setName('persona').setRequired(true)),

  new SlashCommandBuilder()
    .setName('info')
    .setDescription('Enviar embed desde JSON')
    .addStringOption(option =>
      option.setName('nombre').setRequired(true)),

  new SlashCommandBuilder()
    .setName('editarroblox')
    .setDescription('Actualizar avatar Roblox')
    .addStringOption(option =>
      option.setName('nombre').setRequired(true))
    .addStringOption(option =>
      option.setName('usuario').setRequired(true))
];

// =====================
// 🚀 REGISTRAR
// =====================

if (process.env.REGISTER_COMMANDS === "true") {
  const rest = new REST({ version: '10' }).setToken(TOKEN);

  (async () => {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log("✅ Comandos registrados");
  })();
}

// =====================
// 🤖 READY
// =====================

client.once('ready', () => {
  console.log(`🤖 Bot listo como ${client.user.tag}`);
});

// =====================
// 🧩 EMBED RESEÑAS
// =====================

function generarEmbedReseñas(username, promedio, total, listaReseñas) {
  return {
    description: `# ⋆˚࿔ ┆ Reseñas de ${username}┆
### ⭐ Promedio:
> ${promedio}
### 📜 Total:
> ${total}

### 🕒 Últimas:
${listaReseñas}`,
    color: 16758784
  };
}

// =====================
// 💬 INTERACCIONES
// =====================

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  // =====================
  // 📂 INFO
  // =====================
  if (interaction.commandName === 'info') {
    const nombre = interaction.options.getString('nombre');

    try {
      const path = `./Embeds/${nombre}.json`;
      const perfil = JSON.parse(fs.readFileSync(path, 'utf8'));

      const mensaje = await interaction.channel.send({
        embeds: perfil.embeds
      });

      // 🔥 guardar IDs automáticamente
      perfil.channelId = mensaje.channel.id;
      perfil.embedId = mensaje.id;

      fs.writeFileSync(path, JSON.stringify(perfil, null, 2));

    } catch (error) {
      console.error(error);
      return interaction.reply({ content: "❌", ephemeral: true });
    }
  }

  // =====================
  // 🧩 SET EMBED MANUAL
  // =====================
  if (interaction.commandName === 'setembed') {
    const user = interaction.options.getUser('persona');
    const mensaje_id = interaction.options.getString('mensaje_id');

    try {
      const mensaje = await interaction.channel.messages.fetch(mensaje_id);

      data[user.id] = {
        reviews: [],
        embedId: mensaje.id,
        channelId: mensaje.channel.id
      };

      saveLater();

      return interaction.reply({ content: "✅ Registrado", ephemeral: true });

    } catch {
      return interaction.reply({ content: "❌ No encontrado", ephemeral: true });
    }
  }

  // =====================
  // ⭐ RESEÑA
  // =====================
  if (interaction.commandName === 'reseña') {

    const user = interaction.options.getUser('persona');
    const persona = user.id;

    const estrellas = interaction.options.getInteger('estrellas');
    const comentario = interaction.options.getString('comentario');

    if (!data[persona]) {
      return interaction.reply({ content: "❌ No tiene perfil", ephemeral: true });
    }

    data[persona].reviews.push({
      estrellas,
      comentario,
      name: interaction.user.username
    });

    const reviews = data[persona].reviews;
    const total = reviews.length;

    const promedio = (
      reviews.reduce((a, r) => a + r.estrellas, 0) / total
    ).toFixed(1);

    const lista = reviews.map(r =>
      `> ⭐ ${r.estrellas} ${r.name}: ${r.comentario}`
    ).join("\n");

    try {
      const canal = await client.channels.fetch(data[persona].channelId);
      const mensaje = await canal.messages.fetch(data[persona].embedId);

      await mensaje.edit({
        embeds: [generarEmbedReseñas(user.username, promedio, total, lista)]
      });

    } catch {
      console.log("❌ Error editando embed");
    }

    saveLater();
    return interaction.reply({ content: "✅ Reseña guardada", ephemeral: true });
  }

  // =====================
  // 🎮 EDITAR ROBLOX
  // =====================
  if (interaction.commandName === 'editarroblox') {
    const nombre = interaction.options.getString('nombre');
    const username = interaction.options.getString('usuario');

    try {
      const path = `./Embeds/${nombre}.json`;
      const perfil = JSON.parse(fs.readFileSync(path, 'utf8'));

      const userId = await getRobloxId(username);
      const avatar = await getRobloxAvatar(userId);

      const embed = perfil.embeds.find(e => e.author?.name === "Roblox");

      embed.image = { url: avatar };

      fs.writeFileSync(path, JSON.stringify(perfil, null, 2));

      await actualizarMensajeDesdeJSON(client, nombre);

      return interaction.reply({ content: "✅ Avatar actualizado", ephemeral: true });

    } catch (error) {
      console.error(error);
      return interaction.reply({ content: "❌ Error", ephemeral: true });
    }
  }

});

client.login(TOKEN);
