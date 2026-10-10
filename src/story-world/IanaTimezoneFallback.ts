/**
 * Canonical named zones from IANA tzdb 2026c zone1970.tab.
 * This compact fallback is used only when the host cannot supply its own ICU list.
 */
// Group by IANA region so each shared prefix has one maintained definition.
const ZONES_BY_REGION: Readonly<Record<string, readonly string[]>> = {
  Africa: [
    "Abidjan", "Algiers", "Bissau", "Cairo", "Casablanca", "Ceuta",
    "El_Aaiun", "Johannesburg", "Juba", "Khartoum", "Lagos", "Maputo",
    "Monrovia", "Nairobi", "Ndjamena", "Sao_Tome", "Tripoli", "Tunis",
    "Windhoek",
  ],
  America: [
    "Adak", "Anchorage", "Araguaina", "Argentina/Buenos_Aires", "Argentina/Catamarca", "Argentina/Cordoba",
    "Argentina/Jujuy", "Argentina/La_Rioja", "Argentina/Mendoza", "Argentina/Rio_Gallegos", "Argentina/Salta", "Argentina/San_Juan",
    "Argentina/San_Luis", "Argentina/Tucuman", "Argentina/Ushuaia", "Asuncion", "Bahia", "Bahia_Banderas",
    "Barbados", "Belem", "Belize", "Boa_Vista", "Bogota", "Boise",
    "Cambridge_Bay", "Campo_Grande", "Cancun", "Caracas", "Cayenne", "Chicago",
    "Chihuahua", "Ciudad_Juarez", "Costa_Rica", "Coyhaique", "Cuiaba", "Danmarkshavn",
    "Dawson", "Dawson_Creek", "Denver", "Detroit", "Edmonton", "Eirunepe",
    "El_Salvador", "Fort_Nelson", "Fortaleza", "Glace_Bay", "Goose_Bay", "Grand_Turk",
    "Guatemala", "Guayaquil", "Guyana", "Halifax", "Havana", "Hermosillo",
    "Indiana/Indianapolis", "Indiana/Knox", "Indiana/Marengo", "Indiana/Petersburg", "Indiana/Tell_City", "Indiana/Vevay",
    "Indiana/Vincennes", "Indiana/Winamac", "Inuvik", "Iqaluit", "Jamaica", "Juneau",
    "Kentucky/Louisville", "Kentucky/Monticello", "La_Paz", "Lima", "Los_Angeles", "Maceio",
    "Managua", "Manaus", "Martinique", "Matamoros", "Mazatlan", "Menominee",
    "Merida", "Metlakatla", "Mexico_City", "Miquelon", "Moncton", "Monterrey",
    "Montevideo", "New_York", "Nome", "Noronha", "North_Dakota/Beulah", "North_Dakota/Center",
    "North_Dakota/New_Salem", "Nuuk", "Ojinaga", "Panama", "Paramaribo", "Phoenix",
    "Port-au-Prince", "Porto_Velho", "Puerto_Rico", "Punta_Arenas", "Rankin_Inlet", "Recife",
    "Regina", "Resolute", "Rio_Branco", "Santarem", "Santiago", "Santo_Domingo",
    "Sao_Paulo", "Scoresbysund", "Sitka", "St_Johns", "Swift_Current", "Tegucigalpa",
    "Thule", "Tijuana", "Toronto", "Vancouver", "Whitehorse", "Winnipeg",
    "Yakutat",
  ],
  Antarctica: [
    "Casey", "Davis", "Macquarie", "Mawson", "Palmer", "Rothera",
    "Troll", "Vostok",
  ],
  Asia: [
    "Almaty", "Amman", "Anadyr", "Aqtau", "Aqtobe", "Ashgabat",
    "Atyrau", "Baghdad", "Baku", "Bangkok", "Barnaul", "Beirut",
    "Bishkek", "Chita", "Colombo", "Damascus", "Dhaka", "Dili",
    "Dubai", "Dushanbe", "Famagusta", "Gaza", "Hebron", "Ho_Chi_Minh",
    "Hong_Kong", "Hovd", "Irkutsk", "Jakarta", "Jayapura", "Jerusalem",
    "Kabul", "Kamchatka", "Karachi", "Kathmandu", "Khandyga", "Kolkata",
    "Krasnoyarsk", "Kuching", "Macau", "Magadan", "Makassar", "Manila",
    "Nicosia", "Novokuznetsk", "Novosibirsk", "Omsk", "Oral", "Pontianak",
    "Pyongyang", "Qatar", "Qostanay", "Qyzylorda", "Riyadh", "Sakhalin",
    "Samarkand", "Seoul", "Shanghai", "Singapore", "Srednekolymsk", "Taipei",
    "Tashkent", "Tbilisi", "Tehran", "Thimphu", "Tokyo", "Tomsk",
    "Ulaanbaatar", "Urumqi", "Ust-Nera", "Vladivostok", "Yakutsk", "Yangon",
    "Yekaterinburg", "Yerevan",
  ],
  Atlantic: [
    "Azores", "Bermuda", "Canary", "Cape_Verde", "Faroe", "Madeira",
    "South_Georgia", "Stanley",
  ],
  Australia: [
    "Adelaide", "Brisbane", "Broken_Hill", "Darwin", "Eucla", "Hobart",
    "Lindeman", "Lord_Howe", "Melbourne", "Perth", "Sydney",
  ],
  Europe: [
    "Andorra", "Astrakhan", "Athens", "Belgrade", "Berlin", "Brussels",
    "Bucharest", "Budapest", "Chisinau", "Dublin", "Gibraltar", "Helsinki",
    "Istanbul", "Kaliningrad", "Kirov", "Kyiv", "Lisbon", "London",
    "Madrid", "Malta", "Minsk", "Moscow", "Paris", "Prague",
    "Riga", "Rome", "Samara", "Saratov", "Simferopol", "Sofia",
    "Tallinn", "Tirane", "Ulyanovsk", "Vienna", "Vilnius", "Volgograd",
    "Warsaw", "Zurich",
  ],
  Indian: [
    "Chagos", "Maldives", "Mauritius",
  ],
  Pacific: [
    "Apia", "Auckland", "Bougainville", "Chatham", "Easter", "Efate",
    "Fakaofo", "Fiji", "Galapagos", "Gambier", "Guadalcanal", "Guam",
    "Honolulu", "Kanton", "Kiritimati", "Kosrae", "Kwajalein", "Marquesas",
    "Nauru", "Niue", "Norfolk", "Noumea", "Pago_Pago", "Palau",
    "Pitcairn", "Port_Moresby", "Rarotonga", "Tahiti", "Tarawa", "Tongatapu",
  ],
};

export const IANA_TIMEZONE_FALLBACK: readonly string[] = Object.entries(ZONES_BY_REGION)
  .flatMap(([region, zones]) => zones.map(zone => `${region}/${zone}`));
