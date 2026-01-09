from typing import Final
import asyncio
import aiohttp
# pip install python-telegram-bot
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

print('Bot is now starting up...')

# API_TOKEN: Final = '8234352611:AAE9rL2-ccRcf44xxd3akvcd4wfIHimoC5I'
import os  # Add this at the top

# DELETE YOUR TOKEN FROM HERE. Use Environment Variables instead.
API_TOKEN = os.getenv("TELEGRAM_TOKEN")
BOT_HANDLE: Final = "tg_wp_whatsapp_bot"

# --- WHATSAPP SENDING LOGIC ---import aiohttp

NODE_SERVER_URL = "http://localhost:3000/send-message"


async def send_to_whatsapp(text: str):
    async with aiohttp.ClientSession() as session:
        payload = {
            "message": text
        }
        async with session.post(NODE_SERVER_URL, json=payload) as response:
            if response.status == 200:
                print("✅ Sent to Node.js successfully")
            else:
                print(f"❌ Failed to send to Node.js: {response.status}")


# --- COMMAND HANDLERS ---
async def initiate_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text('Bot is listening!')

async def assist_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text('I forward channel posts to WhatsApp.')

# --- MESSAGE PROCESSOR ---
async def process_channel_post(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    This specific function handles posts coming from a CHANNEL.
    """
    # 1. Get the text from the channel post
    # Note: In channels, we look at 'channel_post', not 'message'
    post = update.channel_post
    
    if not post:
        return

    text: str = post.text
    chat_title: str = post.chat.title

    print(f'New post in channel "{chat_title}": {text}')

    # 2. Filter logic (Optional: only forward if it contains "Deal")
    # if "deal" in text.lower():
    
    # 3. Send to WhatsApp
    await send_to_whatsapp(text)


async def process_group_or_private(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    This handles normal DMs or Group chats (your old logic)
    """
    chat_type: str = update.message.chat.type
    text: str = update.message.text
    
    print(f'User ({update.message.chat.id}) in {chat_type}: "{text}"')
    
    # Your old logic for 'hi'/'hello'
    if 'hi' in text.lower() or 'hello' in text.lower():
        await update.message.reply_text("Hello there!")

async def log_error(update: Update, context: ContextTypes.DEFAULT_TYPE):
    print(f'Update caused error: {context.error}')

# --- MAIN ---
if __name__ == '__main__':
    # increased timeouts to fix your connection issues
    app = Application.builder().token(API_TOKEN).read_timeout(30).write_timeout(30).build()

    # Commands
    app.add_handler(CommandHandler('start', initiate_command))
    app.add_handler(CommandHandler('help', assist_command))

    # HANDLER 1: Listen to Channel Posts
    # This filter specifically looks for updates from Channels
    app.add_handler(MessageHandler(filters.ChatType.CHANNEL, process_channel_post))

    # HANDLER 2: Listen to Private/Group Messages
    app.add_handler(MessageHandler(filters.TEXT & (~filters.ChatType.CHANNEL), process_group_or_private))

    # Errors
    app.add_error_handler(log_error)

    print('Starting polling...')
    app.run_polling(poll_interval=3)