export const CLIENT_ID = '255269326633-fk0dsvgfqtlapir3vb73k7tdj4cgd63h.apps.googleusercontent.com'

export const SHEET_TAB    = 'All Items'
export const SETTINGS_TAB = 'Settings'
export const SHEET_HDR    = [
  'ID','Name','Category','Group','Group ID','Brand','Size','Colors',
  'Location','Tags','Description','Photo URL','Photo Preview','Date Added','On Loan To','Loan Log'
]
export const POLL_MS = 20000   // 20s — faster for real-time feel

// Drive folder names
export const APP_FOLDER_NAME     = 'Wilson Closet'
export const PHOTOS_FOLDER_NAME  = 'Pictures'
export const SHEETS_FOLDER_NAME  = 'Sheets'

export const COLORS = [
  {n:'White',h:'#FFFFFF'},{n:'Black',h:'#1C1917'},{n:'Gray',h:'#9CA3AF'},
  {n:'Navy',h:'#1E3A5F'},{n:'Blue',h:'#2563EB'},{n:'Sky Blue',h:'#7DD3FC'},
  {n:'Teal',h:'#0D9488'},{n:'Green',h:'#16A34A'},{n:'Olive',h:'#84CC16'},
  {n:'Red',h:'#DC2626'},{n:'Pink',h:'#EC4899'},{n:'Purple',h:'#9333EA'},
  {n:'Yellow',h:'#EAB308'},{n:'Orange',h:'#F97316'},{n:'Brown',h:'#92400E'},
  {n:'Beige',h:'#D4B896'},{n:'Cream',h:'#FEF9C3'},{n:'Burgundy',h:'#7F1D1D'},
]

export const TAGS_SUGGEST = [
  'Casual','Formal','Work','Sport','Summer','Winter',
  'Vintage','Luxury','Streetwear','Loungewear','Baby','Kids','School'
]

export const CATEGORIES = ['Tops','Bottoms','Dresses','Outerwear','Shoes','Accessories','Other']

export const CAT_EMOJI = {
  Tops:'👕',Bottoms:'👖',Dresses:'👗',Outerwear:'🧥',
  Shoes:'👟',Accessories:'👜',Other:'📦'
}

// ── SIZES — adult + kids
export const SIZES_ADULT_CLOTHES  = ['XS','S','M','L','XL','XXL','XXXL','One Size']
export const SIZES_KIDS_CLOTHES   = ['Newborn','0-3M','3-6M','6-9M','9-12M','12-18M','18-24M','2T','3T','4T','5T','6','7','8','10','12','14','16']
export const SIZES_ADULT_SHOES    = ['5','5.5','6','6.5','7','7.5','8','8.5','9','9.5','10','10.5','11','11.5','12','13','14']
export const SIZES_KIDS_SHOES     = ['1C','2C','3C','4C','5C','6C','7C','8C','9C','10C','11C','12C','13C','1Y','2Y','3Y','4Y','5Y','6Y','7Y']

export const GROUP_COLORS = ['gc1','gc2','gc3','gc4','gc5','gc6','gc7']
export const GROUP_EMOJIS = ['👔','👗','👶','👦','👧','🧑','📦','🏠','❄️','⭐','🎽','🧳']

export const DEFAULT_GROUPS = [
  {id:'g1',name:'My Closet',     emoji:'👔',color:'gc1'},
  {id:'g2',name:"Son's Closet",  emoji:'👦',color:'gc2'},
  {id:'g3',name:'Storage Closet',emoji:'📦',color:'gc3'},
]

export const DEFAULT_LOCATIONS = [
  'Main Closet','Storage Closet','Bedroom Dresser','Garage'
]
