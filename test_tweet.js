require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const { TwitterApi } = require('twitter-api-v2');
const { HttpsProxyAgent } = require('https-proxy-agent');

const agent = new HttpsProxyAgent('http://172.16.2.250:3128');
const xClient = new TwitterApi({
  appKey: process.env.X_CONSUMER_KEY,
  appSecret: process.env.X_CONSUMER_SECRET,
  accessToken: process.env.X_ACCESS_TOKEN,
  accessSecret: process.env.X_ACCESS_SECRET,
}, { httpAgent: agent });

const DOC_AFFILIATE = 'https://docs.google.com/document/d/1O8Kcwg7jn3qa9kmS5y5an5sGF7xF1LTRfYSTt54h-kk/export?format=txt';
const DOC_MEMES = 'https://docs.google.com/document/d/1-fbXzXtRWUlUyZZ_3m33wKNvJVXQ-kx040NDqKiXFC0/export?format=txt';

const memeCaptions = [
    "Tag that one friend who always does this! 😂",
    "Why is this so relatable? 💀",
    "I'm in this photo and I don't like it. 😂",
    "Dead. 💀 Retweet if you agree!",
    "Can't stop laughing at this one. Follow for more! ✨",
    "The accuracy is painful. 😭😂",
    "Me every single time. Why am I like this? 😭"
];

const hashtagPool = {
    fashion: ["#FashionDeals", "#StyleOnABudget", "#MyntraFashion", "#ClothingSales", "#TrendAlert"],
    deals: ["#LootLo", "#StealDeal", "#DealsIndia", "#OnlineShopping", "#PriceDrop", "#LootDeals"],
    memes: ["#MemesIndia", "#Funny", "#DailyMemes", "#Humor", "#DesiMemes", "#Laugh", "#Trending", "#MemeLoot", "#Comedy"],
    general: ["#Savings", "#BestDeals", "#ShopNow", "#IndiaDeals", "#OffersToday", "#AmazonIndia"]
};

// --- UPDATED LOGIC: GENERATE CONTENT WITH TELEGRAM FOOTER ---
function generateFinalPost(isMeme, originalText) {
    let baseText = "";
    let footer = "";

    if (isMeme) {
        // AI Meme Caption
        baseText = memeCaptions[Math.floor(Math.random() * memeCaptions.length)];
    } else {
        // Affiliate Post + Telegram Footer
        baseText = originalText;
        footer = "\n\nJoin https://t.me/Lightning_offer";
    }

    // Hashtag Filler Logic
    let selectedTags = new Set();
    let pool = isMeme ? hashtagPool.memes.concat(hashtagPool.general) : hashtagPool.deals.concat(hashtagPool.fashion);
    pool = pool.sort(() => 0.5 - Math.random());

    // We calculate limit based on (Base Text + Footer + Space for Tags)
    for (let tag of pool) {
        let potentialString = baseText + footer + "\n\n" + [...selectedTags, tag].join(' ');
        if (potentialString.length < 275) {
            selectedTags.add(tag);
        } else {
            break;
        }
    }

    const tagsString = selectedTags.size > 0 ? "\n\n" + [...selectedTags].join(' ') : "";
    return baseText + footer + tagsString;
}

function getDirectLink(url) {
    const match = url.match(/\/d\/([^/]+)/);
    return match ? `https://drive.google.com/uc?export=download&id=${match[1]}` : null;
}

async function postLatestFromDoc() {
  try {
    let useMemeDoc = false;
    if (fs.existsSync('toggle_state.txt')) {
        const lastUsed = fs.readFileSync('toggle_state.txt', 'utf8');
        useMemeDoc = (lastUsed === 'affiliate'); 
    }

    const currentDocUrl = useMemeDoc ? DOC_MEMES : DOC_AFFILIATE;
    const typeLabel = useMemeDoc ? "MEME" : "AFFILIATE";
    
    console.log(`--- [${new Date().toLocaleTimeString()}] Fetching Latest ${typeLabel} ---`);

    const response = await axios.get(`${currentDocUrl}&t=${Date.now()}`, { 
      httpsAgent: agent, headers: { 'Cache-Control': 'no-cache' }
    });

    let fullText = response.data.replace(/^\uFEFF/, '');
    fullText = fullText.replace(/^[\s\S]*?(?=Post\s*#)/i, '');
    const posts = fullText.split(/(?=Post\s*#)/i).map(p => p.trim()).filter(p => p.length > 20);

    if (posts.length === 0) {
        console.log("No posts found in doc.");
        return;
    }

    let rawPost = posts[posts.length - 1]; 

    // Extract Media
    const driveLinkMatch = rawPost.match(/https:\/\/drive\.google\.com\/[^\s]+/);
    let mediaId = null;
    if (driveLinkMatch) {
        const downloadUrl = getDirectLink(driveLinkMatch[0]);
        if (downloadUrl) {
            const imageRes = await axios.get(downloadUrl, { responseType: 'arraybuffer', httpsAgent: agent });
            mediaId = await xClient.v1.uploadMedia(Buffer.from(imageRes.data), { mimeType: 'image/jpeg' });
        }
    }

    // Clean text
    let cleanText = rawPost
        .split('\n').slice(1).join('\n') 
        .replace(/Shared by.*?\n/gi, '')
        .replace(/download|@MemeFarm_bot/gi, '')       
        .replace(/https:\/\/drive\.google\.com\/[^\s]+/, '') 
        .replace(/\(https:\/\/t\.me\/.*?\)/, '') 
        .trim();

    // Generate Final Post
    const finalTweet = generateFinalPost(useMemeDoc, cleanText);

    console.log(`Posting ${typeLabel}:\n`, finalTweet);
    const tweetParams = { text: finalTweet };
    if (mediaId) tweetParams.media = { media_ids: [mediaId] };

    await xClient.v2.tweet(tweetParams);
    
    fs.writeFileSync('toggle_state.txt', useMemeDoc ? 'meme' : 'affiliate');
    console.log("Post successful.");

  } catch (error) {
    console.error('Error:', error.message);
  }
}

postLatestFromDoc();
setInterval(postLatestFromDoc, 11400000);