// Publisher RSS feeds, by section: unlike Google News (headlines only), these
// carry a real summary, which is what lets the writer say what a story MEANS.
// Each feed was checked live (Nov 17, 2026). Add or remove freely; a dead feed
// is skipped and counted as a source failure.
export const FEEDS = {
  money: ['https://www.coindesk.com/arc/outboundfeeds/rss/', 'https://www.theblock.co/rss.xml'],
  defi: ['https://thedefiant.io/api/feed'],
  web3: ['https://decrypt.co/feed'],
  ai: ['https://techcrunch.com/category/artificial-intelligence/feed/', 'https://www.technologyreview.com/feed/'],
  robotics: ['https://www.therobotreport.com/feed/'],
  defense: ['https://breakingdefense.com/feed/', 'https://www.defensenews.com/arc/outboundfeeds/rss/'],
  space: ['https://spacenews.com/feed/', 'https://www.nasaspaceflight.com/feed/'],
  lifesci: ['https://www.statnews.com/feed/'],
  energy: ['https://www.utilitydive.com/feeds/news/', 'https://www.canarymedia.com/rss.xml', 'https://www.ans.org/news/feed/'],
  food: ['https://agfundernews.com/feed', 'https://www.greenqueen.com.hk/feed/'],
  deep: ['https://thequantuminsider.com/feed/'],
  regulation: ['https://www.sec.gov/news/pressreleases.rss'],
  vc: ['https://news.crunchbase.com/feed/', 'https://techcrunch.com/category/venture/feed/'],
  macro: ['https://feeds.marketwatch.com/marketwatch/topstories/', 'https://www.federalreserve.gov/feeds/press_all.xml'],
  frontier: ['https://www.quantamagazine.org/feed/', 'https://www.sciencedaily.com/rss/top/science.xml'],
};

// How each publisher is named as a source in the brief.
export const FEED_NAMES = {
  'coindesk.com': 'CoinDesk', 'theblock.co': 'The Block', 'thedefiant.io': 'The Defiant', 'decrypt.co': 'Decrypt',
  'techcrunch.com': 'TechCrunch', 'technologyreview.com': 'MIT Technology Review', 'therobotreport.com': 'The Robot Report',
  'breakingdefense.com': 'Breaking Defense', 'defensenews.com': 'Defense News', 'spacenews.com': 'SpaceNews',
  'nasaspaceflight.com': 'NASASpaceflight', 'statnews.com': 'STAT', 'utilitydive.com': 'Utility Dive',
  'canarymedia.com': 'Canary Media', 'ans.org': 'Nuclear Newswire (ANS)', 'agfundernews.com': 'AgFunderNews',
  'greenqueen.com.hk': 'Green Queen', 'thequantuminsider.com': 'The Quantum Insider', 'sec.gov': 'SEC',
  'crunchbase.com': 'Crunchbase News', 'marketwatch.com': 'MarketWatch', 'federalreserve.gov': 'Federal Reserve',
  'quantamagazine.org': 'Quanta Magazine', 'sciencedaily.com': 'ScienceDaily',
};
