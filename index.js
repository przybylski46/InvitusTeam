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
const fetch = require('node-fetch');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// =====================
// 🧠 CACHE ROBLOX
// =====================

const robloxCache = new Map();
const CACHE_TIME = 10 * 60 * 1000;

async function getRobloxAvatar(userId) {
  const now = Date.now();

  if (robloxCache.has(userId)) {
    const cached = robloxCache.get(userId);
    if (now - cached.timestamp < CACHE_TIME) {
      return cached.url;
    }
  }

  try {
    const res = await fetch(`https://thumbnails.roblox.com/v1/users/avatar?userIds=${userId}&size=420x420&format=Png&isCircular=false`);
    const data = await res.json();

    const avatarUrl = data?.data?.[0]?.imageUrl;

    if (!avatarUrl) throw new Error("No avatar");

    robloxCache.set(userId, {
      url: avatarUrl,
      timestamp: now
    });

    return avatarUrl;

  } catch (err) {
    console.log("❌ Error Roblox:", err);
    return null;
  }
}

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
// ⚙️ COMANDOS
// =====================

const commands = [

new SlashCommandBuilder()
.setName('info')
.setDescription('Embed')
.addStringOption(option =>
  option.setName('nombre')
  .setDescription('Nombre del archivo')
  .setRequired(true)
),

new SlashCommandBuilder()
.setName('actualizaravatar')
.setDescription('Actualizar avatar de Roblox')
.addStringOption(option =>
  option.setName('nombre')
  .setDescription('Nombre del archivo')
  .setRequired(true)
)

];

// =====================
// 🚀 REGISTRAR
// =====================

if (process.env.REGISTER_COMMANDS === "true") {
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
}

// =====================
// READY
// =====================

client.once('ready', () => {
  console.log(`🤖 Bot listo como ${client.user.tag}`);
});

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
      const perfil = JSON.parse(
        fs.readFileSync(`./Embeds/${nombre}.json`, 'utf8')
      );

      if (perfil.robloxId && perfil.embeds[1]) {
        const avatar = await getRobloxAvatar(perfil.robloxId);
        if (avatar) {
          perfil.embeds[1].image.url = avatar;
        }
      }

      await interaction.channel.send(perfil);

    } catch (error) {
      console.log(error);
      return interaction.reply({ content: "❌ Error", ephemeral: true });
    }
  }

  // =====================
  // 🔄 ACTUALIZAR AVATAR
  // =====================
  if (interaction.commandName === 'actualizaravatar') {
    const nombre = interaction.options.getString('nombre');

    try {
      const perfil = JSON.parse(
        fs.readFileSync(`./Embeds/${nombre}.json`, 'utf8')
      );

      if (!perfil.robloxId) {
        return interaction.reply({ content: "❌ No tiene robloxId", ephemeral: true });
      }

      const avatar = await getRobloxAvatar(perfil.robloxId);

      if (!avatar) {
        return interaction.reply({ content: "❌ No se pudo obtener avatar", ephemeral: true });
      }

      perfil.embeds[1].image.url = avatar;

      await interaction.channel.send(perfil);

      return interaction.reply({ content: "✅ Avatar actualizado", ephemeral: true });

    } catch (error) {
      console.log(error);
      return interaction.reply({ content: "❌ Error", ephemeral: true });
    }
  }

});

client.login(TOKEN);