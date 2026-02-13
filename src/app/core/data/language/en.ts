export const dataEn = {
  home: {
    hero: {
      headlineLine1: 'THOUGHT IT WOULD BE',
      headlineLine2: 'WORSE.',
      subtext: '(the sentence we hear most right after a tattoo)',
      description: 'Afraid of pain? Everyone is. Then they walk into Rebis and realize...',
      ctaLine1: 'BOOK NOW',
      ctaLine2: 'YOUR TATTOO'
    },
    about: {
      title: 'CLIENT APPROACH',
      paragraph1: 'At Rebis Tattoo every tattoo is a unique artwork.',
      paragraph2: 'Book your free consultation now.',
      cta: 'Learn more'
    },
    services: {
      title: 'Our Services',
      subtitle: 'Discover different styles and artistic approaches',
      items: [
        { title: 'Cover-up', desc: 'We cover unwanted old tattoos' },
        { title: 'Fine Line', desc: 'Thin and detailed lines' },
        { title: 'Realism', desc: 'Portraits and hyper-realistic details' },
        { title: 'Lettering', desc: 'Custom scripts and fonts' }
      ]
    },
    projects: {
      title: 'Recent Projects',
      subtitle: 'A selection of our most representative works.'
    },
    showcase: {
      title: 'Our Artistic Showcase',
      subtitle: 'Rebis Tattoo is where top artists show their work.<strong>Discover our best creations.</strong>',
      description: 'Our studio gives each artist space to express unique talent and ideas. Browse our gallery and get inspired for your next tattoo.',
      cta: 'SEE ALL WORKS ->'
    },
    faqTitle: 'FREQUENT QUESTIONS',
    faq: [
      {
        question: 'How can I book an appointment?',
        answer: 'Use the booking button on the homepage or the form at the bottom of the page.'
      },
      {
        question: 'How old do I need to be?',
        answer: 'You must be at least 18. In some cases, signed parental consent is required for minors.'
      },
      {
        question: 'Does it hurt?',
        answer: 'Pain depends on area and sensitivity, but it is generally manageable.'
      }
    ]
  },
  portfolio: {
    title: 'Our works',
    subtitle: 'Some tattoos made in our studio',
    filtersTitle: 'Filter works',
    artistLabel: 'Artist',
    styleLabel: 'Style',
    searchLabel: 'Search',
    all: 'All',
    details: 'View work ->',
    stylePrefix: 'Style: ',
    artistPrefix: 'Artist: ',
    datePrefix: 'Done on '
  },
  aboutPage: {
    title: 'ABOUT US',
    intro: 'At Rebis Tattoo every tattoo is visual storytelling. Our mission is to create art that reflects your identity.',
    cta: 'Contact us',
    artistsTitle: 'ARTISTS WE ARE PROUD OF',
    expLabel: 'Experience',
    styleLabel: 'Style',
    levelLabel: 'Level',
    portfolio: 'Go to Portfolio'
  },
  contact: {
    title: 'Contacts',
    subtitle: 'Got an idea or want a consultation? Book now or message us.',
    chatbot: {
      question: 'Prefer to chat now?',
      cta: 'Open chat'
    },
    locationTitle: 'Where we are',
    address: 'Via al Carmine 1A, 07100 Sassari (SS)',
    phone: '+39 340 099 8312',
    email: 'sarapushi@rebistattoo.info',
    hoursTitle: 'Availability',
    hours: {
      mondayFriday: 'By appointment',
      saturday: 'By appointment',
      sunday: 'By appointment'
    },
    ctaTitle: 'Ready for your next tattoo?',
    ctaButton: 'Book a consultation'
  },
  bonus: {
    client: {
      header: {
        title: 'Bonus and Gift Cards',
        subtitle: 'Manage promo codes and gift cards. Redeemed credits go into your wallet.'
      },
      wallet: {
        title: 'Credit Wallet',
        updatedAt: 'Updated'
      },
      promo: {
        title: 'Apply Promo Code',
        codeLabel: 'Promo code',
        placeholder: 'Ex. PROMO-AB12CD',
        submit: 'Apply promo',
        loading: 'Applying...'
      },
      gift: {
        title: 'Redeem Gift Card',
        codeLabel: 'Gift card code',
        placeholder: 'Ex. GIFT-XY90ZT',
        submit: 'Redeem gift card',
        loading: 'Redeeming...'
      },
      ledger: {
        title: 'Credit History',
        subtitle: 'Latest promo and gift card operations',
        typePromo: 'Promo',
        typeGift: 'Gift Card',
        typeAdjustment: 'Adjustment',
        empty: 'No transactions available.'
      }
    },
    admin: {
      header: {
        title: 'Bonus and Gift Card Management',
        subtitle: 'Create promo codes and gift cards, monitor usage and status.'
      },
      promoForm: {
        title: 'New Promo Code',
        codeLabel: 'Code (optional)',
        codePlaceholder: 'PROMO-AB12CD',
        creditLabel: 'Credit EUR',
        maxUsesLabel: 'Max uses (optional)',
        expiryLabel: 'Expiration',
        descriptionLabel: 'Description',
        submit: 'Create promo',
        loading: 'Saving...'
      },
      giftForm: {
        title: 'New Gift Card',
        codeLabel: 'Code (optional)',
        codePlaceholder: 'GIFT-XY90ZT',
        amountLabel: 'Amount EUR',
        expiryLabel: 'Expiration',
        noteLabel: 'Note',
        submit: 'Create gift card',
        loading: 'Saving...'
      },
      list: {
        promoTitle: 'Promo Codes',
        giftTitle: 'Gift Cards',
        usagePrefix: 'uses',
        balanceSuffix: 'remaining on',
        activeToggle: 'Active',
        noPromos: 'No promo codes.',
        noGifts: 'No gift cards.'
      }
    },
    service: {
      errors: {
        invalidPromoAmount: 'Invalid promo amount',
        invalidGiftAmount: 'Invalid gift card amount',
        enterPromoCode: 'Enter a promo code',
        promoNotFound: 'Promo code not found',
        promoAlreadyUsed: 'You already used this promo code',
        enterGiftCode: 'Enter a gift card code',
        giftNotFound: 'Gift card not found',
        giftAlreadyRedeemed: 'Gift card already redeemed',
        notAuthenticated: 'User not authenticated',
        onlyManager: 'Action allowed only for admin or staff',
        codeAlreadyExists: 'Code {code} already exists',
        promoDisabled: 'Promo code disabled',
        promoExpired: 'Promo code expired',
        promoExhausted: 'Promo code exhausted',
        giftDisabled: 'Gift card not active',
        giftExpired: 'Gift card expired'
      },
      feedback: {
        promoCreated: 'Promo {code} created',
        promoCreateError: 'Promo creation error',
        promoEnabled: 'Promo enabled',
        promoDisabled: 'Promo disabled',
        promoUpdateError: 'Promo update error',
        giftCreated: 'Gift card {code} created',
        giftCreateError: 'Gift card creation error',
        giftEnabled: 'Gift card enabled',
        giftDisabled: 'Gift card disabled',
        giftUpdateError: 'Gift card update error',
        promoApplied: 'Promo applied: +{amount} EUR',
        promoApplyError: 'Promo apply error',
        giftRedeemed: 'Gift card redeemed: +{amount} EUR',
        giftRedeemError: 'Gift card redeem error'
      },
      notifications: {
        promoTitle: 'Promo applied',
        promoMessage: 'Code {code} applied: +{amount} EUR',
        giftTitle: 'Gift card redeemed',
        giftMessage: 'Gift card {code} redeemed: +{amount} EUR'
      }
    }
  }
};
