import type { MetaLocation, LocationSource } from '../types/index.ts';

const addressTypeLabel: Record<string, string> = {
    city: "Cidade",
    town: "Cidade",
    village: "Vila",
    suburb: "Bairro",
    neighbourhood: "Bairro",
    city_district: "Distrito municipal",
    district: "Distrito",
    state_district: "Região",
    county: "Município/Condado",
    state: "Estado",
    country: "País",
    road: "Rua",
    railway: "Estação/Ferrovia",
    amenity: "Local",
    shop: "Comércio",
    tourism: "Turismo",
    building: "Edifício",
    place: "Localidade",
    highway: "Via",
    leisure: "Lazer",
    natural: "Área natural",
    waterway: "Curso d'água",
    historic: "Histórico",
    man_made: "Estrutura",
    office: "Escritório",
    craft: "Serviço",
    emergency: "Emergência",
    healthcare: "Saúde",
    public_transport: "Transporte público",
    boundary: "Limite administrativo",
    landuse: "Uso do solo",
};

const locationTypeLabel: Record<string, string> = {
    city: "Cidade",
    town: "Cidade",
    village: "Vila",
    municipality: "Município",
    suburb: "Bairro",
    neighbourhood: "Bairro",
    city_district: "Distrito municipal",
    district: "Distrito",
    state_district: "Região",
    county: "Município",
    province: "Província",
    state: "Estado",
    country: "País",
    road: "Rua",
    railway: "Estação/Ferrovia",
    place: "Local",
};

function compactAddress(address?: Record<string, string>) {
    if (!address) return "";

    return [
        address.road,
        address.neighbourhood,
        address.suburb,
        address.city_district,
        address.district,
        address.city || address.town || address.village || address.municipality,
        address.state,
        address.country,
    ]
        .filter(Boolean)
        .join(", ");
}

function pickBestName(loc: any) {
    const namedetails = loc.namedetails ?? {};
    const address = loc.address ?? {};

    return (
        loc.name ||
        namedetails["name:pt-BR"] ||
        namedetails["name:pt"] ||
        namedetails.name ||
        namedetails.official_name ||
        address.neighbourhood ||
        address.suburb ||
        address.city_district ||
        address.district ||
        address.road ||
        address.city ||
        address.town ||
        address.village ||
        ""
    );
}

export function normalizeNominatimLocation(
    loc: any,
    radius: number,
    source: LocationSource
): MetaLocation {
    const explicitName = Boolean(
        loc.name ||
        loc.namedetails?.name ||
        loc.namedetails?.["name:pt"] ||
        loc.namedetails?.["name:pt-BR"]
    );

    const type = loc.addresstype || loc.type || loc.class || "place";
    const typeLabel = addressTypeLabel[type] || type;

    const bestName = pickBestName(loc);
    const shortAddress = compactAddress(loc.address);
    const displayName = loc.display_name || shortAddress;

    const fallbackName =
        bestName ||
        shortAddress ||
        displayName ||
        `Ponto em ${Number(loc.lat).toFixed(5)}, ${Number(loc.lon).toFixed(5)}`;

    return {
        id: String(loc.place_id ?? `${loc.osm_type ?? "osm"}-${loc.osm_id ?? crypto.randomUUID()}`),
        name: fallbackName,
        label: `${typeLabel}: ${fallbackName}`,
        subtitle: displayName && displayName !== fallbackName ? displayName : shortAddress || undefined,

        lat: String(loc.lat),
        long: String(loc.lon),

        type,
        typeLabel,
        radius,
        context: displayName,

        osmType: loc.osm_type,
        osmId: loc.osm_id,
        placeRank: loc.place_rank,
        category: loc.class,

        source,
        hasExplicitName: explicitName,
        debugReason: explicitName
            ? undefined
            : "O OpenStreetMap não possui uma tag de nome explícita para este ponto; foi usado endereço, tipo ou coordenadas como fallback.",
    };
}

const normalizeText = (value?: string | null) =>
    String(value ?? "")
        .trim()
        .replace(/\s+/g, " ");

const getTypeLabel = (type?: string) =>
    locationTypeLabel[type ?? ""] ?? type ?? "Local";

const formatCoord = (value?: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed.toFixed(5) : "";
};

const getContextParts = (context?: string) =>
    normalizeText(context)
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);

const removeDuplicatedNameFromContext = (parts: string[], name: string) => {
    const normalizedName = normalizeText(name).toLowerCase();

    return parts.filter((part, index) => {
        if (index > 0) return true;
        return normalizeText(part).toLowerCase() !== normalizedName;
    });
};

const buildShortContext = (location: MetaLocation, maxParts = 3) => {
    const name = normalizeText(location.name);
    const parts = removeDuplicatedNameFromContext(
        getContextParts(location.context),
        name
    );

    if (parts.length === 0) return "";

    return parts.slice(0, maxParts).join(", ");
};

const buildLocationMainLabel = (location: MetaLocation) => {
    const typeLabel = getTypeLabel(location.type);
    const name = normalizeText(location.name);

    if (!name || name.toUpperCase() === "EMPTY") {
        return `${typeLabel}: ponto sem nome`;
    }

    return `${typeLabel}: ${name}`;
};

export const buildLocationTagLabel = (
    location: MetaLocation,
    allSelectedLocations: MetaLocation[]
) => {
    const mainLabel = buildLocationMainLabel(location);

    const sameMainLabelCount = allSelectedLocations.filter(
        (item) => buildLocationMainLabel(item) === mainLabel
    ).length;

    if (sameMainLabelCount <= 1) {
        return mainLabel;
    }

    const shortContext = buildShortContext(location, 2);

    if (shortContext) {
        return `${mainLabel} · ${shortContext}`;
    }

    const lat = formatCoord(location.lat);
    const long = formatCoord(location.long);

    if (lat && long) {
        return `${mainLabel} · ${lat}, ${long}`;
    }

    return `${mainLabel} · ID ${location.id}`;
};

const emptyLikeValues = new Set(["", "empty", "null", "undefined"]);

export const normalizeTextDetails = (value?: string | null) =>
    String(value ?? "")
        .trim()
        .replace(/\s+/g, " ");

export const isEmptyLocationNameDetails = (name?: string | null) => {
    const normalized = normalizeTextDetails(name).toLowerCase();
    return emptyLikeValues.has(normalized);
};

export const getTypeLabelDetails = (type?: string | null) =>
    locationTypeLabel[normalizeTextDetails(type) ?? ""] ??
    addressTypeLabel[normalizeTextDetails(type) ?? ""] ??
    normalizeTextDetails(type) ??
    "Local";

export const getContextPartsDetails = (context?: string | null) =>
    normalizeTextDetails(context)
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);

export const removeDuplicatedNameFromContextDetails = (
    parts: string[],
    name?: string | null
) => {
    if (isEmptyLocationNameDetails(name)) return parts;

    const normalizedName = normalizeTextDetails(name).toLowerCase();

    return parts.filter((part, index) => {
        if (index > 0) return true;
        return normalizeTextDetails(part).toLowerCase() !== normalizedName;
    });
};

export const buildShortContextDetails = (location: MetaLocation, maxParts = 3) => {
    const parts = removeDuplicatedNameFromContextDetails(
        getContextPartsDetails(location.context),
        location.name
    );

    return parts.slice(0, maxParts).join(", ");
};

export const getLocationDisplayNameDetails = (location: MetaLocation) => {
    const name = normalizeTextDetails(location.name);

    if (!isEmptyLocationNameDetails(name)) {
        return name;
    }

    const contextParts = getContextPartsDetails(location.context);

    if (contextParts.length > 0) {
        return contextParts.slice(0, 2).join(", ");
    }

    return "Localidade";
};

export const buildLocationMainLabelDetails = (location: MetaLocation) => {
    const typeLabel = getTypeLabelDetails(location.type);
    const displayName = getLocationDisplayNameDetails(location);

    return `${typeLabel}: ${displayName}`;
};

export const buildLocationTagLabelDetails = (
    location: MetaLocation,
    allSelectedLocations: MetaLocation[]
) => {
    const mainLabel = buildLocationMainLabelDetails(location);

    const sameMainLabelCount = allSelectedLocations.filter(
        (item) => buildLocationMainLabelDetails(item) === mainLabel
    ).length;

    if (sameMainLabelCount <= 1) {
        return mainLabel;
    }

    const shortContext = buildShortContextDetails(location, 2);

    if (shortContext) {
        return `${mainLabel} · ${shortContext}`;
    }

    return `${mainLabel} · ID ${location.id}`;
};

export const buildLocationDetailsDisplayDetails = (location: MetaLocation) => {
    const typeLabel = getTypeLabelDetails(location.type);
    const hasName = !isEmptyLocationNameDetails(location.name);

    const title = getLocationDisplayNameDetails(location);

    const contextParts = removeDuplicatedNameFromContextDetails(
        getContextPartsDetails(location.context),
        location.name
    );

    const subtitle = hasName
        ? contextParts.slice(0, 3).join(", ")
        : contextParts.slice(2, 5).join(", ");

    return {
        typeLabel,
        title,
        subtitle,
        radiusLabel: `${location.radius} km`,
        fullContext: location.context || title,
        hasName,
    };
};