# Discord Wordle Results Tracker Bot

A Firebase Cloud Functions-powered Discord bot for tracking, aggregating, and visualizing daily Wordle results in your server. Automatically collects results, posts infographics, and provides personal and server-wide stats.

---

## 🚀 Features

- **Automatic Wordle Results Tracking:**  
  Scans your designated channel every morning at 6am, collecting and storing the previous day's Wordle results.
- **Daily Infographic:**  
  Posts a detailed summary and leaderboard for “yesterday’s Wordle” with stats, podium, and fun facts.
- **Slash Commands:**
  - `/initsetup date:YYYY-MM-DD` — Populate Firestore with historical Wordle data up to a given date.
  - `/printresults` — Print the most recent Wordle infographic (does not fetch new results).
  - `/personalstats user:@username` — Show personal Wordle stats for a user.
  - `/help` — Show help and usage instructions.
- **Personal and Server Stats:**  
  Track streaks, win rates, average scores, and more.
- **Secure:**  
  Uses Firebase secrets for all tokens and sensitive data.

---

## ⚡️ Setup & Deployment

### Prerequisites

- Node.js 22+
- Firebase CLI (`npm install -g firebase-tools`)
- A Firebase project with Firestore enabled
- A Discord bot application and token

### Installation

1. **Clone the repository:**
   ```sh
   git clone https://github.com/yourusername/discord-wordle-bot.git
   cd discord-wordle-bot/functions
   ```

2. **Install dependencies:**
   ```sh
   npm install
   ```

3. **Configure Firebase:**
   - Set up your Firebase project and initialize Functions/Firestore.
   - Add your secrets using the Firebase CLI:
     ```sh
     firebase functions:secrets:set DISCORD_PUBLIC_KEY
     firebase functions:secrets:set DISCORD_BOT_TOKEN
     firebase functions:secrets:set DISCORD_APPLICATION_ID
     firebase functions:secrets:set ADMIN_PASSWORD
     ```

4. **Set your Discord channel and guild IDs:**
   - Edit `functions/src/index.ts` and set `WORDLE_CHANNEL_ID` and `GUILD_ID` to your server’s values.

5. **Deploy to Firebase:**
   ```sh
   npm run deploy
   ```

6. **Register Slash Commands:**
   - Use the `/registerCommands` endpoint (see code comments) with your admin password to register or update commands.

---

## 💬 Usage

- **Wordle results are automatically collected and posted every morning at 6am.**
- Use the slash commands in your Discord server for stats, help, and manual actions.
- The bot only needs permission to read messages and post in the results channel.

---

## 📝 Example Commands

| Command                        | Description                                                      |
|--------------------------------|------------------------------------------------------------------|
| `/initsetup date:2023-01-01`   | Populate Firestore with historical data up to Jan 1, 2023        |
| `/printresults`                | Print the most recent Wordle infographic                         |
| `/personalstats user:@Alice`   | Show personal Wordle stats for Alice                             |
| `/help`                        | Show help and usage instructions                                 |

---

## 🔒 Security & Best Practices

- **Keep your secrets safe:** Never commit tokens or secrets to source control.
- **Set proper Firestore rules:** Restrict access to only the bot.
- **Bot permissions:** Only grant the bot the minimum permissions it needs.

---

## 🤝 Contributing

Pull requests and suggestions are welcome! Please open an issue for bugs or feature requests.

---

## 📄 License

MIT