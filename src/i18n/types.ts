export type LocaleCode = "it" | "en" | "fr" | "de" | "es" | "pt" | "zh" | "ja" | "ko";

export interface Translation {
  langName: string;
  nav: {
    location: string;
    home: string;
    gallery: string;
    amenities: string;
    area: string;
    reviews: string;
    booking: string;
    manage: string;
  };
  hero: { subtitle: string; bookDirect: string; bookAirbnb: string; bookOn: string; alsoOn: string };
  story: { title: string; p1: string; p2: string };
  gallery: { title: string };
  details: {
    title: string;
    rating: string; // template, use {rating} and {count}
  };
  amenities: { title: string; items: string[] };
  area: {
    title: string;
    subtitle: string;
    places: { name: string; distance: string }[];
    mapApartmentLabel: string;
    mapMetroLabel: string;
  };
  reviews: {
    title: string;
    subtitleOwn: string;
    aggregateReviews: string;
    empty: string;
    verified: string;
    writeCta: string;
    backToList: string;
    writeTitle: string;
    name: string;
    namePlaceholder: string;
    nameHint: string;
    yourRating: string;
    yourReview: string;
    stayMonth: string;
    stayMonthPh: string;
    stayMonthHint: string;
    bookingCode: string;
    bookingCodeHelp: string;
    email: string;
    emailHelp: string;
    consent: string;
    transparency: string;
    submit: string;
    sending: string;
    success: string;
    error: string;
  };
  booking: {
    title: string;
    subtitle: string;
    preferAirbnb: string;
    goToListing: string;
    months: string[];
    weekdays: string[];
    prevMonth: string;
    nextMonth: string;
    nightSingular: string;
    nightPlural: string;
    selectCheckout: string;
    totalEstimate: string;
    plusCityTax: string;
    clearSelection: string;
    requestDates: string;
  };
  form: {
    title: string;
    helpWithDates: string;
    helpNoDates: string;
    selectedDates: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    guests: string;
    checkinLabel: string;
    checkoutLabel: string;
    message: string;
    messagePlaceholder: string;
    submit: string;
    sending: string;
    note: string;
    success: string; // template, use {code}
    error: string;
    datesUnavailable: string;
  };
  footer: { copyright: string; admin: string };
  payment: {
    eyebrow: string;
    title: string;
    guests: string; // template, use {count}
    payWithPaypal: string;
    payWithCard: string;
    cardName: string;
    cardNumber: string;
    cardExpiry: string;
    cardCvc: string;
    cardNote: string;
    paypalNote: string;
    confirmButton: string;
    processing: string;
    notApproved: string;
    notFound: string;
    loading: string;
    totalStayPrice: string;
    depositDueNow: string;
    balanceDueAtCheckin: string; // template, use {amount}
    cityTaxNote: string; // template, use {amount}
    cityTaxLineItem: string; // nome voce tassa di soggiorno (line item Stripe / ricevuta PDF)
    cityTaxOnlineNote: string; // template {amount} — variante online: tassa inclusa nel pagamento come voce separata
    refundPolicy: string;
    depositOnlyButton: string;
    fullAmountButton: string;
    howMuchTitle: string;
    depositLabel: string;
    sliderMin: string;
    sliderMax: string;
    totalDueNow: string;
    balanceLabel: string;
    secureNote: string;
  };
  payBalance: {
    title: string;
    bookingCode: string; // template {code}
    alreadyPaidTitle: string;
    alreadyPaidMsg: string; // template {code}
    cityTaxLabel: string; // template {guests}
    totalLabel: string;
    redirecting: string;
    payButton: string; // template {amount}
    successTitle: string;
    successMsg: string; // template {code}
    backHome: string;
  };
  manageLinkPage: {
    title: string;
    description: string; // template {example}
    sent: string;
    spamNote: string;
    retry: string;
    codeLabel: string;
    codePlaceholder: string;
    sending: string;
    submitButton: string;
  };
  manage: {
    pageTitle: string;
    loading: string;
    invalidLinkBefore: string;
    invalidLinkPage: string;
    invalidLinkAfter: string;
    cancelledTitle: string;
    cancelledRefundMsg: string; // template {amount}
    cancelledNoRefundMsg: string;
    statusPending: string;
    statusApproved: string;
    statusCompleted: string;
    statusCancelled: string;
    statusRejected: string;
    labelGuest: string;
    labelGuests: string;
    labelCheckin: string;
    labelCheckout: string;
    labelTotalStay: string;
    labelTotalPaid: string;
    labelDepositPaid: string;
    labelBalance: string;
    labelBalanceDue: string; // template {amount}
    labelCityTax: string; // etichetta cella tassa di soggiorno nel riepilogo
    proceedToPayment: string;
    downloadReceipt: string;
    balanceSectionTitle: string;
    balanceDueText: string; // template {amount}
    balanceCityTax: string; // template {amount}
    balanceCityTaxOnline: string; // template {amount} — variante online: tassa già inclusa nell'anticipo online
    payBalanceButton: string;
    cancelSectionTitle: string;
    cancelPolicyTitle: string;
    cancelFreeMsg: string;
    cancelFullRefundMsg: string; // template {days, threshold, fee_pct}
    cancelFullRefundDetail: string; // template {paid, fee_pct, fee, refund}
    cancelHalfRefundMsg: string; // template {days, halfThreshold, fullThreshold}
    cancelHalfRefundDetail: string; // template {paid, refund}
    cancelNoneMsg: string; // template {days, threshold}
    cancelNoneContactBefore: string;
    cancelNoneContactAfter: string;
    cancelRefundCredit: string;
    cancelCityTaxRefund: string; // template {amount} — riga separata: tassa online rimborsata per intero (tutte le finestre)
    cancelConfirmPrompt: string;
    cancelConfirmYes: string;
    cancelConfirmNo: string;
    cancelButton: string;
  };
  checkinInfo: {
    title: string;
    addressLabel: string;
    phoneLabel: string;
    emailLabel: string;
    note: string;
  };
  confirmation: {
    eyebrow: string;
    title: string; // template, use {name}
    subtitle: string;
    guests: string; // template, use {count}
    totalPaid: string;
    method: string;
    paidOn: string;
    downloadPdf: string;
    emailNotice: string;
    notCompleted: string;
    notFound: string;
    loading: string;
    totalStayPrice: string;
    depositPaid: string;
    balanceDueAtCheckin: string; // template, use {amount}
    cityTaxNote: string; // template, use {amount}
    cityTaxOnlineNote: string; // template {amount} — variante online: tassa inclusa nel pagamento online come voce separata
    refundPolicy: string;
    cityTaxLine: string; // etichetta neutra della voce tassa nel breakdown importi
    totalPaidOnline: string; // totale effettivamente addebitato online (alloggio + tassa se online)
  };
}
