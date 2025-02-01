# SimpleDiscordBot

<div align="center">
  
![GitHub License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/language-TypeScript-blue)
[![npm version](https://img.shields.io/npm/v/@pekno/simple-discordbot.svg)](https://www.npmjs.com/package/@pekno/simple-discordbot)

</div>

`SimpleDiscordBot` is a TypeScript library designed to simplify the creation of Discord bots using `discord.js`. It provides a structured approach to handling bot interactions, command registration, and localization.

## 🚀 Why This Package?

This package was created to **reduce code duplication** across my Discord bot projects. After noticing a lot of shared logic between my bots, I decided to extract the core functionalities into a reusable NPM package. This makes bot development **faster, cleaner, and easier to maintain**.

---

## 📦 Installation

```sh
npm install simple-discordbot
```

---

## 🛠️ Configuration

To initialize `SimpleDiscordBot`, provide a configuration object containing your bot credentials, intents, and localization settings.

### Example: **Instantiating the Bot**

```ts
import { SimpleDiscordBot } from "simple-discordbot";
import { GatewayIntentBits } from "discord.js";

class MyService {
  // Your custom service logic here
}

const myService = new MyService();

const simpleBot = new SimpleDiscordBot<MyService>(
  {
    discord_token: CONFIG.DISCORD_TOKEN ?? "",
    discord_id: CONFIG.DISCORD_ID ?? "",
    intents: [GatewayIntentBits.Guilds],
    locale: CONFIG.LOCALE,
    available_locale: localList,
    locale_directory: localesPath,
  },
  myService
);
```

### Configuration Options:

| Option             | Type                   | Description                          |
|-------------------|----------------------|----------------------------------|
| `discord_token`   | `string`              | Your bot's authentication token. |
| `discord_id`      | `string`              | Your bot's application ID.       |
| `intents`         | `GatewayIntentBits[]` | List of intents required.        |
| `locale`          | `string`              | Default bot locale.              |
| `available_locale`| `string[]`            | Supported locales.               |
| `locale_directory`| `string`              | Path to locale JSON files.       |

---

## 🔥 Creating Commands

### **Command Parameters**

| Parameter         | Type                                             | Description                                      |
|------------------|------------------------------------------------|--------------------------------------------------|
| `name`           | `string`                                       | Command name.                                   |
| `clickAlias`     | `string`                                       | Alias for triggering the command via interactions. |
| `description`    | `string`                                       | Command description.                            |
| `options`        | `CommandOption[]`                              | List of available options for the command.      |
| `execute`        | `(interaction, client, service, extraInfo?, payload?) => Promise<void>` | Function to execute when the command is triggered. |
| `registerPredicate` | `() => boolean`                            | Function to determine if the command should be registered (usefull for command only based on available features). |

> [!TIP]
> `execute`'s' `extraInfo` is an object containing all data passed through `customId`, for example if you fill a button with `A=1;B=2;C=3`, `extraInfo` will be equal `{A: "1", B: "2", C: "3"}`.
> `execute`'s' `payload` is an object containing data from modals.

### **Basic Command Example**

```ts
import { Command, CommandList } from "simple-discordbot";
import { ChatInputCommandInteraction, Client } from "discord.js";

const simpleCommandsList = new CommandList<MyService>();

simpleCommandsList.push(
  new Command({
    name: "start",
    description: "Starts an action",
    execute: async (
      interaction: ChatInputCommandInteraction,
      client: Client,
      myService: MyService
    ) => {
      await interaction.deferReply();
      // Use myService inside command execution
      await interaction.editReply("Command executed successfully.");
    },
  })
);
```

---

### **Command with Options**

```ts
import { Command, CommandList, CommandOption } from "simple-discordbot";
import { ApplicationCommandOptionType, ChatInputCommandInteraction, Client } from "discord.js";

simpleCommandsList.push(
  new Command({
    name: "add",
    description: "Adds an item",
    options: [
      new CommandOption({
        name: "item_name",
        description: "The name of the item",
        type: ApplicationCommandOptionType.String,
        required: true,
      }),
    ],
    execute: async (
      interaction: ChatInputCommandInteraction,
      client: Client,
      myService: MyService
    ) => {
      await interaction.deferReply();
      const itemName = interaction.options.getString("item_name");
      await interaction.editReply(`Added item: ${itemName}`);
    },
  })
);
```

---

### **Modal Submission Example**

```ts
import { ModalSubmitCommand } from "simple-discordbot";
import { ModalSubmitInteraction, Client } from "discord.js";

simpleCommandsList.push(
  new ModalSubmitCommand({
    name: "submit_feedback_modal",
    execute: async (
      interaction: ModalSubmitInteraction,
      client: Client,
      myService: MyService,
      extraInfo: any,
      payload: any
    ) => {
      const { userId } = extraInfo as { userId: string };
      const { feedback } = payload as { feedback: string };
      await interaction.deferReply({ ephemeral: true });
      if (!feedback) throw new Error("Feedback cannot be empty.");
      console.log(`User ${userId} submitted feedback: ${feedback}`);
      interaction.editReply({ content: "Thank you for your feedback!" });
    },
  })
);
```

---

## 🚀 Running the Bot

Once your bot and commands are set up, start your bot with:

```ts
const client = await simpleBot.start(simpleCommandsList);
```

> [!TIP]
> Calling `start` will return the `Client` object used by the bot, if you ever need it somewhere else.

## 🔥 Using (Throttled) API

### Creating the API classes

You can extends `MainApi` if you want to use the built-in API, it can be throttled to a limited request per minutes

```ts
class myFirstApi extends MainApi{
    //...
}
const requestPerMinutes = 30;
const myFirstApi = new RiotAPI(
    { 'My-Header-Token': "value" },
    requestPerMinutes
);
```

```ts
class MySecondApi extends MainApi {
    //...
}
const mySecondApi = new MySecondApi();
```

### Example: Making an API Request

Then by just using the `get` function available from `MainApi`, the request is queued and will be resolved as soon as possible depending if a `maxRequestsPerMinute` is defined.

```ts
fetchData = async (endpoint: string): Promise<any> => {
  try {
    const response = await this.get(`https://api.example.com/${endpoint}`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) return null;
    throw error;
  }
};
```

---

## 📜 License

This project is licensed under **MIT**.

---

## 📚 Additional Notes

- This package relies on `discord.js`, make sure to install it.
- The library includes **i18n support**, allowing easy localization.
- The command structure is **fully typed**, making development safer.

---

## 🔗 Contributing & Source Code

Contributions and feedback are always welcome!
If you have any suggestions or issues, feel free to open an issue or submit a pull request.

Happy coding! 🎉

