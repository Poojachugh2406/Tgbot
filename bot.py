import base64
from typing import Final
import aiohttp
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes

# ---------------- CONFIGURATION ---------------- #
API_TOKEN: Final = '8234352611:AAE9rL2-ccRcf44xxd3akvcd4wfIHimoC5I'
NODE_SERVER_URL = "http://localhost:3000/send-message"

# --- USERNAME MAPPING CONFIGURATION ---
# Enter the usernames WITHOUT the '@' symbol
# Example: If your link is t.me/TechNews, put "TechNews"
SOURCE_USERNAME_1 = "Lightning_deals_smurfie" 
SOURCE_USERNAME_2 = "Lightning_offers_smurf"

# WhatsApp Destinations
WHATSAPP_GROUP_1_TARGET = "Lightning Deals"   # Destination for Source 1
WHATSAPP_GROUP_2_TARGET ="Lightning Offers"       # Destination for Source 2
# ----------------------------------------------- #

print('Bot is now starting up...')

# --- WHATSAPP SENDING LOGIC ---
async def send_to_whatsapp(text: str, media: str, target_group: str):
    async with aiohttp.ClientSession() as session:
        payload = {
            "message": text,
            "media": media,
            "group_id": target_group 
        }
        try:
            async with session.post(NODE_SERVER_URL, json=payload) as response:
                if response.status == 200:
                    print(f"✅ Sent to Node.js (Target: {target_group})")
                else:
                    print(f"❌ Node.js Error ({response.status}): {await response.text()}")
        except Exception as e:
            print(f"❌ Connection Error: {e}")


# --- COMMAND HANDLERS ---
async def initiate_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text('Bot is listening to specific usernames!')

async def assist_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text('I route posts based on Channel Usernames.')

# --- MESSAGE PROCESSOR (CHANNELS) ---
async def process_channel_post(update: Update, context: ContextTypes.DEFAULT_TYPE):
    post = update.channel_post
    if not post: return

    # 1. GET USERNAME (Handle case where channel is private/has no username)
    raw_username = post.chat.username
    
    if not raw_username:
        # If raw_username is None, it's likely a private channel
        # print(f"⚠️ Ignored post from private channel (ID: {post.chat.id})")
        return

    # Normalize to lowercase for easy comparison
    current_username = raw_username.lower()
    target_wa_group = None

    # 2. ROUTING LOGIC (Case Insensitive)
    if current_username == SOURCE_USERNAME_1.lower():
        target_wa_group = WHATSAPP_GROUP_1_TARGET
        print(f"🔄 Source: @{raw_username} -> Routing to: {target_wa_group}")
    
    elif current_username == SOURCE_USERNAME_2.lower():
        target_wa_group = WHATSAPP_GROUP_2_TARGET
        print(f"🔄 Source: @{raw_username} -> Routing to: {target_wa_group}")
    
    else:
        # Ignore other channels
        return

    # 3. EXTRACT CONTENT
    text_content = post.text or post.caption or ""
    media_b64 = None

    # 4. HANDLE PHOTOS
    if post.photo:
        try:
            print(f"📸 Downloading image from @{raw_username}...")
            photo_obj = post.photo[-1]
            file_obj = await photo_obj.get_file()
            image_bytes = await file_obj.download_as_bytearray()
            media_b64 = base64.b64encode(image_bytes).decode('utf-8')
        except Exception as e:
            print(f"⚠️ Error processing image: {e}")

    # 5. SEND
    if text_content or media_b64:
        await send_to_whatsapp(text_content, media_b64, target_wa_group)


# --- MAIN ---
if __name__ == '__main__':
    app = Application.builder()\
        .token(API_TOKEN)\
        .read_timeout(60)\
        .write_timeout(60)\
        .build()

    app.add_handler(CommandHandler('start', initiate_command))
    app.add_handler(CommandHandler('help', assist_command))

    # Listen to Channel Posts
    app.add_handler(MessageHandler(filters.ChatType.CHANNEL, process_channel_post))

    print('🚀 Username Router Started...')
    print(f'   Listening for: @{SOURCE_USERNAME_1}')
    print(f'   Listening for: @{SOURCE_USERNAME_2}')
    
    app.run_polling(poll_interval=2)

