# ![Logo](logo.png) Simple-DiscordBot

<div align="center">
  
![GitHub License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/language-TypeScript-blue)
[![npm version](https://img.shields.io/npm/v/@pekno/simple-discordbot.svg)](https://www.npmjs.com/package/@pekno/simple-discordbot)
[![npm download](https://img.shields.io/npm/d18m/%40pekno%2Fsimple-discordbot)](https://www.npmjs.com/package/@pekno/simple-discordbot)

</div>

`SimpleDiscordBot` is a TypeScript library designed to simplify the creation of Discord bots using `discord.js`. It provides a structured approach to handling bot interactions, command registration, and localization.

## 🚀 Why This Package?

This package was created to **reduce code duplication** across my Discord bot projects. After noticing a lot of shared logic between my bots, I decided to extract the core functionalities into a reusable NPM package. This makes bot development **faster, cleaner, and easier to maintain**.
> [!TIP]
> You can checkout my bots that use this libray, [League of Legends Gamble Bot](https://github.com/Pekno/lolgamblebot) & [SUNO Discord Bot](https://github.com/Pekno/sunobot)

---

## 📦 Installation

```sh
npm install @pekno/simple-discordbot
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
| `execute`        | `(interaction, client, service, extraInfo?, modalPayload?) => Promise<void>` | Function to execute when the command is triggered. |
| `registerPredicate` | `() => boolean`                            | Function to determine if the command should be registered (usefull for command only based on available features). |

> [!TIP]
> `execute`'s' `extraInfo` is an object containing all data passed through `customId`, for example if you fill a button with `command;A:=1;B:=2;C:=3`, `extraInfo` will be equal `{A: "1", B: "2", C: "3"}`.
> `execute`'s' `modalPayload` is an object containing data from modals.

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

The `CommandOption` class now provides factory methods for easier creation of different option types:

```ts
import { Command, CommandList, CommandOption } from "simple-discordbot";
import { ChatInputCommandInteraction, Client } from "discord.js";

simpleCommandsList.push(
  new Command({
    name: "add",
    description: "Adds an item",
    options: [
      // Using the string factory method
      CommandOption.string(
        "item_name",
        "The name of the item",
        true, // required
        false // autocomplete
      ),
      // Using the integer factory method
      CommandOption.integer(
        "quantity",
        "The quantity to add",
        false // optional
      ),
      // Using the boolean factory method
      CommandOption.boolean(
        "notify",
        "Whether to send a notification",
        false // optional
      )
    ],
    execute: async (
      interaction: ChatInputCommandInteraction,
      client: Client,
      myService: MyService
    ) => {
      await interaction.deferReply();
      const itemName = interaction.options.getString("item_name");
      const quantity = interaction.options.getInteger("quantity") ?? 1;
      const notify = interaction.options.getBoolean("notify") ?? false;
      
      await interaction.editReply(`Added ${quantity} of ${itemName}. Notification: ${notify ? 'Yes' : 'No'}`);
    },
  })
);
```

You can still use the traditional constructor approach if needed:

```ts
new CommandOption({
  name: "item_name",
  description: "The name of the item",
  type: ApplicationCommandOptionType.String,
  required: true,
})
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
      modalPayload: ModalSubmitFields
    ) => {
      const { userId } = extraInfo as { userId: string };
      const feedback = modalPayload?.getField('feedback')?.value;
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

## 🔥 Using the API Client with Circuit Breaker

### Creating API Classes

You can extend `MainApi` to create custom API clients with built-in request queuing, rate limiting, and circuit breaker functionality.

```ts
class MyFirstApi extends MainApi {
    //...
}
const requestPerMinutes = 30;
const myFirstApi = new MyFirstApi(
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

### Making API Requests

The `MainApi` class now provides methods for all common HTTP verbs. All requests are queued and processed according to rate limits.

```ts
// GET request
const getData = async (endpoint: string): Promise<any> => {
  try {
    const response = await this.get(`https://api.example.com/${endpoint}`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) return null;
    throw error;
  }
};

// POST request
const createData = async (endpoint: string, data: any): Promise<any> => {
  try {
    const response = await this.post(`https://api.example.com/${endpoint}`, data);
    return response.data;
  } catch (error: any) {
    throw error;
  }
};

// Other available methods: put(), delete(), patch()
```

### Circuit Breaker Protection

The API client includes a circuit breaker that prevents cascading failures when external services are experiencing issues:

- **Closed State**: Normal operation, requests flow through
- **Open State**: After multiple failures, requests are blocked to prevent overloading the failing service
- **Half-Open State**: After a timeout period, allows a test request to check if the service has recovered

### Resource Management

When you're done with an API instance, properly dispose of it to prevent memory leaks:

```ts
// Clean up resources when done
myApi.dispose();
```

---

## 📜 License

This project is licensed under **MIT**.

---

## 📚 Additional Notes

- This package relies on `discord.js`, make sure to install it.
- The library includes **i18n support**, allowing easy localization.
- The command structure is **fully typed**, making development safer.
- All classes and methods are thoroughly documented with JSDoc comments.

---

## 🔗 Contributing & Source Code

Contributions and feedback are always welcome!
If you have any suggestions or issues, feel free to open an issue or submit a pull request.

Happy coding! 🎉
