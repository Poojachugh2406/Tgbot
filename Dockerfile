# Start with a Node image that includes Chrome dependencies
FROM node:18-bullseye

# 1. Install Python and Pip
RUN apt-get update && apt-get install -y python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

# 2. Install Chrome for Puppeteer
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# 3. Set up the App Directory
WORKDIR /usr/src/app

# 4. Install Node Dependencies
COPY package*.json ./
RUN npm install

# 5. Install Python Dependencies
COPY requirements.txt ./
RUN pip3 install -r requirements.txt

# 6. Copy the rest of the code
COPY . .

# 7. Make the start script executable
RUN chmod +x start.sh

# 8. Start the bot
CMD ["bash", "start.sh"]