// Content type categories with subcategories
export const CONTENT_TYPE_CATEGORIES = [
  {
    id: "beauty",
    name: "Beauty",
    subcategories: [
      "Skincare",
      "Makeup",
      "Haircare",
      "Fragrance",
      "Nail Art",
      "Men's Grooming",
      "K-Beauty",
    ],
  },
  {
    id: "fashion",
    name: "Fashion",
    subcategories: [
      "Outfits",
      "Streetwear",
      "Luxury",
      "Athleisure",
      "Accessories",
      "Footwear",
      "Sustainable Fashion",
    ],
  },
  {
    id: "fitness",
    name: "Fitness",
    subcategories: [
      "Gym Workouts",
      "Home Workouts",
      "Yoga & Pilates",
      "Running",
      "Nutrition",
      "Supplements",
      "Crossfit",
    ],
  },
  {
    id: "food",
    name: "Food",
    subcategories: [
      "Recipes",
      "Restaurant Reviews",
      "Street Food",
      "Desserts",
      "Beverages (Coffee/Tea)",
      "Vegan & Plant-based",
      "Product Taste Tests",
    ],
  },
  {
    id: "gaming",
    name: "Gaming",
    subcategories: [
      "Mobile Games",
      "Console / PC Games",
      "Esports",
      "Walkthroughs / Let's Play",
      "Game Reviews",
      "Game Tips & Tricks",
      "Live Streaming",
    ],
  },
  {
    id: "tech",
    name: "Tech",
    subcategories: [
      "Smartphones",
      "Laptops & PCs",
      "Smart Home",
      "Wearables",
      "Apps",
      "Software & SaaS",
      "Gadget Reviews",
    ],
  },
  {
    id: "finance",
    name: "Finance",
    subcategories: [
      "Personal Finance",
      "Investing",
      "Crypto",
      "Fintech Apps",
      "Money Saving Tips",
      "Tax & Accounting",
    ],
  },
  {
    id: "travel",
    name: "Travel",
    subcategories: [
      "Travel Vlogs",
      "Budget Travel",
      "Luxury Travel",
      "Hotel Reviews",
      "Local Guides",
      "Travel Gear",
    ],
  },
  {
    id: "home_decor",
    name: "Home & Decor",
    subcategories: [
      "Interior Design",
      "DIY Projects",
      "Organization Hacks",
      "Cleaning Tips",
      "Home Appliances",
      "Small Space Ideas",
    ],
  },
  {
    id: "education",
    name: "Education",
    subcategories: [
      "Study Tips",
      "Course Reviews",
      "Skill Tutorials",
      "Language Learning",
      "Career Advice",
      "Exam Prep",
    ],
  },
  {
    id: "art_diy",
    name: "Art & DIY",
    subcategories: [
      "Painting",
      "Drawing",
      "Crafts",
      "Prints & Merch",
      "Handmade Products",
      "Design Tutorials",
    ],
  },
  {
    id: "parenting",
    name: "Parenting",
    subcategories: [
      "Baby Care",
      "Toddler Activities",
      "Kids Education",
      "Parenting Tips",
      "Product Reviews for Parents",
    ],
  },
  {
    id: "sports",
    name: "Sports",
    subcategories: [
      "Football / Soccer",
      "Basketball",
      "Cricket",
      "Running & Training",
      "Cycling",
      "Outdoor Adventure",
    ],
  },
  {
    id: "auto",
    name: "Auto",
    subcategories: [
      "Cars",
      "Bikes",
      "Electric Vehicles (EVs)",
      "Auto Accessories",
      "Car Reviews",
      "Maintenance Tips",
    ],
  },
  {
    id: "pets",
    name: "Pets",
    subcategories: [
      "Pet Care",
      "Pet Training",
      "Pet Food & Products",
      "Funny Pet Videos",
      "Pet Health",
    ],
  },
  {
    id: "business",
    name: "Business",
    subcategories: [
      "Startups",
      "SaaS & Tools",
      "Productivity",
      "Marketing Tips",
      "Side Hustles",
    ],
  },
  {
    id: "entertainment",
    name: "Entertainment",
    subcategories: [
      "Comedy",
      "Drama",
      "Romance",
      "Horror",
      "Emotional / Sad",
      "Memes",
      "Reaction Videos",
      "Sketches / Skits",
      "Parodies",
      "Trailers & Reviews",
    ],
  },
  {
    id: "music_dance",
    name: "Music & Dance",
    subcategories: [
      "Covers",
      "Original Music",
      "Music Production",
      "Dance Choreography",
      "Instrument Tutorials",
    ],
  },
  {
    id: "photo_video",
    name: "Photography & Video",
    subcategories: [
      "Camera Gear",
      "Editing Tutorials",
      "Cinematography",
      "Mobile Filmmaking",
      "Lighting & Sound",
    ],
  },
  {
    id: "sustainability",
    name: "Sustainability",
    subcategories: [
      "Eco Products",
      "Zero Waste",
      "Sustainable Fashion",
      "Green Tech",
      "Upcycling",
    ],
  },
] as const;

// Interests 
export const INTEREST_CATEGORIES = [
  {
    id: "beauty",
    name: "Beauty",
    interests: ["Beauty", "Skincare", "Makeup", "Haircare", "Grooming"],
  },
  {
    id: "fashion",
    name: "Fashion",
    interests: ["Fashion", "Outfits", "Streetwear", "Accessories", "Footwear"],
  },
  {
    id: "fitness",
    name: "Fitness",
    interests: ["Fitness", "Workouts", "Yoga", "Healthy Living"],
  },
  {
    id: "food",
    name: "Food",
    interests: ["Food", "Cooking", "Recipes", "Food Reviews"],
  },
  {
    id: "gaming",
    name: "Gaming",
    interests: ["Gaming", "Mobile Games", "PC/Console Games", "Esports"],
  },
  {
    id: "tech",
    name: "Tech",
    interests: ["Tech", "Apps", "Gadgets", "Tech Reviews"],
  },
  {
    id: "finance",
    name: "Finance",
    interests: ["Finance", "Investing", "Crypto", "Money Tips"],
  },
  {
    id: "travel",
    name: "Travel",
    interests: ["Travel", "Travel Vlogs", "Hotels", "Local Guides"],
  },
  {
    id: "home_decor",
    name: "Home & Decor",
    interests: ["Home & Decor", "DIY", "Cleaning Hacks"],
  },
  {
    id: "education",
    name: "Education",
    interests: ["Education", "Study Tips", "Career Advice"],
  },
  {
    id: "art_craft",
    name: "Art & Craft",
    interests: ["Art & Craft", "Drawing", "Handmade"],
  },
  {
    id: "parenting",
    name: "Parenting",
    interests: ["Parenting", "Kids Activities"],
  },
  {
    id: "sports",
    name: "Sports",
    interests: ["Sports", "Training", "Cycling"],
  },
  {
    id: "automobile",
    name: "Automobile",
    interests: ["Automobile", "Cars", "Bikes"],
  },
  {
    id: "pets",
    name: "Pets",
    interests: ["Pets", "Pet Care"],
  },
  {
    id: "business",
    name: "Business",
    interests: ["Business", "Startups"],
  },
  {
    id: "entertainment",
    name: "Entertainment",
    interests: ["Entertainment", "Comedy", "Memes", "Reactions"],
  },
  {
    id: "music_dance",
    name: "Music & Dance",
    interests: ["Music & Dance", "Singing", "Dancing"],
  },
  {
    id: "photo_video",
    name: "Photo & Video",
    interests: ["Photo & Video", "Editing"],
  },
  {
    id: "sustainability",
    name: "Sustainability",
    interests: ["Sustainability", "Eco Friendly"],
  },
] as const;

export const INTERESTS = INTEREST_CATEGORIES.flatMap(
  (category) => category.interests
) as readonly string[];
