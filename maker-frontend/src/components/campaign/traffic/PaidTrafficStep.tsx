import { Autocomplete, TextField } from "@mui/material";
import React, { useEffect, useState } from "react";
import type {
  AudienceGroup,
  MetaAudience,
  MetaLocation,
  PaidTrafficInfoComplete,
  PaidTrafficStepHandle,
  Placements,
} from "../../../types/index.ts";
import {
  getLocationByCoordinates,
  getLocations,
  getMetaAudience,
} from "../../../utils/MetaDataHandler.ts";
import { buildLocationTagLabel, normalizeNominatimLocation } from "../../../utils/LocationNormalizer.ts";

const autocompleteSx = {
  "& .MuiOutlinedInput-root": {
    backgroundColor: "var(--bg-secondary)",
    borderRadius: "0.5rem",
    padding: "2px 6px !important",
    "& fieldset": { borderColor: "var(--bg-tertiary)", top: 0 },
    "& fieldset legend": { display: "none" },
    "&:hover fieldset": { borderColor: "var(--bg-tertiary)" },
    "&.Mui-focused fieldset": { borderColor: "var(--blue-primary)", borderWidth: "2px" },
  },
  "& .MuiInputBase-input": {
    color: "var(--text-primary)",
    WebkitTextFillColor: "var(--text-primary)",
    fontSize: "0.875rem",
    padding: "8px 6px !important",
  },
  "& .MuiInputBase-input::placeholder": { color: "var(--text-secondary)", opacity: 1 },
  "& .MuiAutocomplete-popupIndicator, & .MuiAutocomplete-clearIndicator": {
    color: "var(--text-secondary)",
  },
  "& .MuiFormHelperText-root": { color: "var(--text-tertiary)", fontSize: "0.7rem", marginLeft: 0 },
};

type PlatformKey = keyof Placements;

const PLACEMENT_CATALOG: {
  key: PlatformKey;
  label: string;
  positions: Array<{ key: string; label: string }>;
}[] = [
  { key: "facebook", label: "Facebook", positions: [{ key: "feed", label: "Feed" }, { key: "stories", label: "Stories" }, { key: "reels", label: "Reels" }] },
  { key: "instagram", label: "Instagram", positions: [{ key: "feed", label: "Feed" }, { key: "stories", label: "Stories" }, { key: "reels", label: "Reels" }, { key: "explore", label: "Explorar" }] },
  { key: "audienceNetwork", label: "Audience Network", positions: [{ key: "native", label: "Native" }, { key: "banner", label: "Banner" }, { key: "interstitial", label: "Interstitial" }] },
  { key: "whatsapp", label: "WhatsApp", positions: [{ key: "status", label: "Status" }] },
  { key: "threads", label: "Threads", positions: [{ key: "feed", label: "Feed" }] },
];

const OBJECTIVE_OPTIONS = [
  { value: "OUTCOME_APP_PROMOTION", label: "Promoção de App" },
  { value: "OUTCOME_AWARENESS", label: "Reconhecimento de Marca" },
  { value: "OUTCOME_ENGAGEMENT", label: "Engajamento" },
  { value: "OUTCOME_LEADS", label: "Leads" },
  { value: "OUTCOME_SALES", label: "Vendas" },
  { value: "OUTCOME_TRAFFIC", label: "Tráfego" },
];

const GENDER_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "male", label: "Masculino" },
  { value: "female", label: "Feminino" },
];

const inputCls = (hasError?: boolean) =>
  `w-full rounded-lg border px-3 py-2.5 text-sm bg-[var(--bg-secondary)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--blue-primary)] transition-all ${
    hasError ? "border-red-500/60" : "border-[var(--bg-tertiary)]"
  }`;

const selectCls = (hasError?: boolean) =>
  `${inputCls(hasError)} appearance-none cursor-pointer`;

const Divider = () => <div className="border-t border-[var(--bg-tertiary)]" />;

const SectionTitle = ({ title, description }: { title: string; description?: string }) => (
  <div className="mb-5">
    <h3 className="text-sm font-semibold text-[var(--text-primary)]">{title}</h3>
    {description && <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{description}</p>}
  </div>
);

interface PaidTrafficStepProps {
  metaForm: PaidTrafficInfoComplete;
  onChangeInfos: (paidTrafficInfos: PaidTrafficInfoComplete) => void;
  innerRef: React.MutableRefObject<PaidTrafficStepHandle | null>;
  adsForMeta: { ads: unknown[]; isEditing: boolean };
  onChangeAdsDestiny: (ads: unknown[]) => void;
}

const PaidTrafficStep = ({
  metaForm,
  onChangeInfos,
  innerRef,
}: PaidTrafficStepProps) => {
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [errorSearch, setErrorSearch] = useState<string>("");
  const [successSearch, setSuccessSearch] = useState<string>("");

  const [inputLocationsValue, setInputLocationsValue] = useState<string>("");
  const [locations, setLocations] = useState<MetaLocation[]>([]);

  const [lat, setLat] = useState<string>("");
  const [lng, setLng] = useState<string>("");
  const [radius, setRadius] = useState(1);

  const [audienceSearch, setAudienceSearch] = useState<Record<string, string>>({});
  const [audienceOptions, setAudienceOptions] = useState<Record<string, MetaAudience[]>>({});

  const handleTogglePlatform = (platform: PlatformKey) => {
    const currentPlatform = metaForm.generalInfos.placements[platform];
    const nextEnabled = !currentPlatform.enabled;
    const clearedPositions = Object.keys(currentPlatform.positions).reduce((acc, key) => {
      acc[key] = false;
      return acc;
    }, {} as Record<string, boolean>);

    onChangeInfos({
      ...metaForm,
      generalInfos: {
        ...metaForm.generalInfos,
        placements: {
          ...metaForm.generalInfos.placements,
          [platform]: {
            ...currentPlatform,
            enabled: nextEnabled,
            positions: nextEnabled
              ? currentPlatform.positions
              : (clearedPositions as typeof currentPlatform.positions),
          },
        },
      },
    });
  };

  const handleTogglePosition = (platform: PlatformKey, position: string) => {
    const currentPlatform = metaForm.generalInfos.placements[platform];
    onChangeInfos({
      ...metaForm,
      generalInfos: {
        ...metaForm.generalInfos,
        placements: {
          ...metaForm.generalInfos.placements,
          [platform]: {
            ...currentPlatform,
            positions: {
              ...currentPlatform.positions,
              [position]: !currentPlatform.positions[position as keyof typeof currentPlatform.positions],
            },
          },
        },
      },
    });
  };

  const handleSelectLocation = (_: React.SyntheticEvent, locations: MetaLocation[]) => {
    onChangeInfos({ ...metaForm!, locations });
  };

  const handleLocations = async () => {
    setLoading(true);

    if (inputLocationsValue === "" && lat === "" && lng === "") {
      setLoading(false);
      setErrorSearch("Nenhum dado foi fornecido");
      return;
    }

    if (lat !== "" && lng !== "") {
      const response = await getLocationByCoordinates(lat, lng);
      const newLocation = normalizeNominatimLocation(response, radius, "reverse");
      if (!newLocation.id) {
        setLoading(false);
        setErrorSearch("Nenhum resultado encontrado");
        return;
      }
      onChangeInfos({ ...metaForm!, locations: [...metaForm.locations, newLocation] });
      setLoading(false);
      return;
    }

    if (!inputLocationsValue || inputLocationsValue.length < 2) {
      setLoading(false);
      return;
    }

    const response = await getLocations(inputLocationsValue);
    setLocations(response.map((loc: any) => normalizeNominatimLocation(loc, radius, "search")));
    setLoading(false);
    setSuccessSearch("Localidades encontradas");
  };

  const createAudienceGroup = (label: string): AudienceGroup => ({
    id: crypto.randomUUID(),
    label,
    items: [],
  });

  const handleAddLimitedAudienceGroup = () => {
    onChangeInfos({
      ...metaForm,
      audienceGroups: [...metaForm.audienceGroups, createAudienceGroup("E também devem corresponder a")],
    });
  };

  const handleRemoveAudienceGroup = (groupId: string) => {
    onChangeInfos({
      ...metaForm,
      audienceGroups: metaForm.audienceGroups.filter((g) => g.id !== groupId),
    });
  };

  const handleSelectedAudienceGroup =
    (groupId: string) =>
    (_: React.SyntheticEvent, values: MetaAudience[]) => {
      onChangeInfos({
        ...metaForm,
        audienceGroups: metaForm.audienceGroups.map((group) =>
          group.id === groupId ? { ...group, items: values } : group
        ),
      });
    };

  useEffect(() => {
    const fetchAudiences = async () => {
      try {
        const activeGroupId = Object.keys(audienceSearch).find((id) => audienceSearch[id]?.trim());
        if (!activeGroupId) return;
        const term = audienceSearch[activeGroupId]?.trim();
        if (!term) { setAudienceOptions((prev) => ({ ...prev, [activeGroupId]: [] })); return; }
        const res = await getMetaAudience(term);
        const unique = Array.from(
          new Map<string, MetaAudience>(
            (res.results ?? []).map((item: any) => [
              `${item.targetingKey}:${item.id}`,
              { id: item.id, name: item.name, path: item.path ?? [], targetingKey: item.targetingKey },
            ])
          ).values()
        );
        setAudienceOptions((prev) => ({ ...prev, [activeGroupId]: unique }));
      } catch (error) {
        console.error(error);
      }
    };
    fetchAudiences();
  }, [audienceSearch]);

  const validateForms = () => {
    const errors: Record<string, string> = {};
    const infos = metaForm!.generalInfos;
    if (!infos.objective) errors.objective = "Objetivo obrigatório";
    if (metaForm.locations.length === 0) errors.locations = "Localidades obrigatórias";
    if (!infos.gender) errors.gender = "Gênero obrigatório";
    if (infos.min_age === 0) errors.minAge = "Idade mínima obrigatória";
    if (infos.max_age === 0) errors.maxAge = "Idade máxima obrigatória";
    if (infos.budget < 600) errors.budget = "Orçamento mínimo é R$ 6,00";
    if (infos.min_age > infos.max_age) {
      errors.minAge = "Incompatível com Idade Máxima";
      errors.maxAge = "Incompatível com Idade Mínima";
    }
    const hasAnyValidPlacement = Object.values(infos.placements).some(
      (platform) => platform.enabled && Object.values(platform.positions).some(Boolean)
    );
    if (!hasAnyValidPlacement) errors.placements = "Selecione pelo menos uma plataforma com um posicionamento";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  useEffect(() => {
    if (innerRef) innerRef.current = { validate: validateForms };
  }, [metaForm]);

  useEffect(() => { setTimeout(() => setErrorSearch(""), 4000); }, [errorSearch]);
  useEffect(() => { setTimeout(() => setSuccessSearch(""), 4000); }, [successSearch]);

  const targetingKeyLabel: Record<string, string> = {
    behaviors: "Comportamento",
    interests: "Interesse",
    work_positions: "Cargo",
    work_employers: "Empresa",
    education_majors: "Formação",
    education_schools: "Escola",
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)]">Objetivo da Campanha *</label>
          <select
            value={metaForm.generalInfos.objective}
            onChange={(e) => onChangeInfos({ ...metaForm, generalInfos: { ...metaForm.generalInfos, objective: e.target.value } })}
            className={selectCls(!!formErrors.objective)}
          >
            <option value="">Selecione o objetivo</option>
            {OBJECTIVE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {formErrors.objective && <p className="text-xs text-red-500">{formErrors.objective}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)]">Gênero *</label>
          <select
            value={metaForm.generalInfos.gender}
            onChange={(e) => onChangeInfos({ ...metaForm, generalInfos: { ...metaForm.generalInfos, gender: e.target.value } })}
            className={selectCls(!!formErrors.gender)}
          >
            {GENDER_OPTIONS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
          {formErrors.gender && <p className="text-xs text-red-500">{formErrors.gender}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)]">Idade mínima *</label>
          <input type="number" value={metaForm.generalInfos.min_age}
            onChange={(e) => onChangeInfos({ ...metaForm, generalInfos: { ...metaForm.generalInfos, min_age: Number(e.target.value) } })}
            className={inputCls(!!formErrors.minAge)} />
          {formErrors.minAge && <p className="text-xs text-red-500">{formErrors.minAge}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)]">Idade máxima *</label>
          <input type="number" value={metaForm.generalInfos.max_age}
            onChange={(e) => onChangeInfos({ ...metaForm, generalInfos: { ...metaForm.generalInfos, max_age: parseInt(e.target.value, 10) } })}
            className={inputCls(!!formErrors.maxAge)} />
          {formErrors.maxAge && <p className="text-xs text-red-500">{formErrors.maxAge}</p>}
        </div>
      </div>

      <Divider />

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-[var(--text-secondary)]">
          Sugestão de Orçamento * <span className="ml-1 text-[var(--text-tertiary)] font-normal">(mínimo R$ 6,00)</span>
        </label>
        <input
          type="text"
          value={`R$ ${(metaForm.generalInfos.budget / 100).toFixed(2).replace(".", ",")}`}
          onChange={(e) => {
            const cents = Number(e.target.value.replace(/\D/g, "") || 0);
            onChangeInfos({ ...metaForm, generalInfos: { ...metaForm.generalInfos, budget: cents } });
          }}
          className={inputCls(!!formErrors.budget)}
        />
        {formErrors.budget && <p className="text-xs text-red-500">{formErrors.budget}</p>}
      </div>

      <Divider />

      <SectionTitle title="Direcionamento detalhado" description="Adicione dados demográficos, interesses ou comportamentos" />
      <div className="space-y-3">
        {metaForm.audienceGroups.map((group, index) => (
          <div key={group.id} className="rounded-xl bg-[var(--bg-secondary)] p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-[var(--text-secondary)]">
                {index === 0 ? "Incluir pessoas que correspondam a pelo menos UM dos seguintes" : "E também devem corresponder a"}
              </p>
              {index > 0 && (
                <button type="button" onClick={() => handleRemoveAudienceGroup(group.id)}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors">Remover</button>
              )}
            </div>
            <Autocomplete
              multiple
              options={audienceOptions[group.id] ?? []}
              getOptionLabel={(option) => option.name}
              value={group.items}
              isOptionEqualToValue={(option, value) => option.id === value.id && option.targetingKey === value.targetingKey}
              onChange={handleSelectedAudienceGroup(group.id)}
              onInputChange={(_, value) => setAudienceSearch((prev) => ({ ...prev, [group.id]: value }))}
              filterSelectedOptions
              slotProps={{
                paper: { sx: { backgroundColor: "var(--bg-secondary)", border: "1px solid var(--bg-tertiary)" } },
                listbox: {
                  sx: {
                    backgroundColor: "var(--bg-secondary)",
                    "& .MuiAutocomplete-option": {
                      color: "var(--text-primary)",
                      "&.Mui-focused, &:hover": { backgroundColor: "rgba(0,122,255,0.12)" },
                    },
                  },
                },
              }}
              renderOption={(props, option) => {
                const pathText = Array.isArray(option.path) ? option.path.join(" > ") : "";
                return (
                  <li {...props} key={`${option.targetingKey}-${option.id}`}>
                    <div className="py-1">
                      <p className="text-sm font-semibold">{option.name}</p>
                      {pathText && <p className="text-xs text-[var(--text-secondary)] mt-0.5">{pathText}</p>}
                      <span className="inline-block mt-1 text-xs px-1.5 py-0.5 rounded bg-[var(--blue-primary)]/10 text-[var(--blue-primary)]">
                        {targetingKeyLabel[option.targetingKey] ?? "Demográfico"}
                      </span>
                    </div>
                  </li>
                );
              }}
              // @ts-ignore renderTags not in MUI v9 types
              renderTags={(value: any[], getTagProps: any) =>
                value.map((option: any, index: number) => {
                  const pathText = Array.isArray(option.path) ? option.path.join(" > ") : "";
                  const label = pathText || option.name;
                  const { key, onDelete, ...tagProps } = getTagProps({ index });
                  return (
                    <span key={key} {...tagProps} title={label}
                      className="inline-flex items-center gap-1.5 px-2 py-2 rounded-full text-xs bg-[var(--blue-primary)] text-white max-w-[360px]">
                      <span className="truncate">{label}</span>
                      <button type="button" aria-label={`Remover ${label}`}
                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete?.(e); }}
                        className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-colors">×</button>
                    </span>
                  );
                })
              }
              renderInput={(params: any) => (
                <TextField {...params} placeholder={metaForm.audienceGroups.length < 1 ? "Buscar interesses, comportamentos..." : ""} sx={autocompleteSx} />
              )}
            />
          </div>
        ))}
      </div>
      <button type="button" onClick={handleAddLimitedAudienceGroup}
        className="mt-3 px-4 py-2 rounded-lg text-xs font-medium bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
        + Limitar mais
      </button>

      <Divider />

      <SectionTitle title="Localidades" description="Busque pelas localidades da campanha" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)]">Nome do local</label>
          <input type="text" value={inputLocationsValue}
            onChange={(e) => { setLng(""); setLat(""); setInputLocationsValue(e.target.value); }}
            placeholder="Ex: São Paulo" className={inputCls()} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)]">Latitude</label>
          <input type="text" value={lat}
            onChange={(e) => { setInputLocationsValue(""); setLat(e.target.value); }}
            placeholder="-23.5505" className={inputCls()} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)]">Longitude</label>
          <input type="text" value={lng}
            onChange={(e) => { setInputLocationsValue(""); setLng(e.target.value); }}
            placeholder="-46.6333" className={inputCls()} />
        </div>
      </div>

      <div className="flex gap-4 items-end mb-5">
        <div className="flex flex-col gap-1.5 flex-1 max-w-[200px]">
          <label className="text-xs font-medium text-[var(--text-secondary)]">Raio (km)</label>
          <input type="number" value={radius} min={1}
            onChange={(e) => { const v = +e.target.value; setRadius(v < 1 ? 1 : v); }}
            className={inputCls()} />
        </div>
        <button type="button" onClick={handleLocations} disabled={loading}
          className="px-5 py-2.5 rounded-lg text-sm font-semibold bg-[var(--blue-primary)] text-white hover:bg-[var(--blue-dark)] transition-colors disabled:opacity-50 flex items-center gap-2">
          {loading && <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
          Buscar
        </button>
      </div>

      {(errorSearch || successSearch) && (
        <p className={`text-xs mb-3 ${errorSearch ? "text-red-400" : "text-green-400"}`}>{errorSearch || successSearch}</p>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-[var(--text-secondary)]">Localidades selecionadas</label>
        <Autocomplete
          multiple
          options={locations}
          getOptionLabel={(option) => option.label || option.context || option.name}
          value={metaForm.locations}
          isOptionEqualToValue={(prev, value) => prev.id === value.id}
          onChange={handleSelectLocation}
          filterSelectedOptions
          slotProps={{
            paper: { sx: { backgroundColor: "var(--bg-secondary)", border: "1px solid var(--bg-tertiary)" } },
            listbox: {
              sx: {
                backgroundColor: "var(--bg-secondary)",
                "& .MuiAutocomplete-option": {
                  color: "var(--text-primary)",
                  "&.Mui-focused, &:hover": { backgroundColor: "rgba(0,122,255,0.12)" },
                },
              },
            },
          }}
          // @ts-ignore renderTags not in MUI v9 types
          renderTags={(value: any[], getTagProps: any) =>
            value.map((option: any, index: number) => {
              const { key, onDelete, ...tagProps } = getTagProps({ index });
              const label = buildLocationTagLabel(option, value);
              return (
                <span key={key} {...tagProps} title={option.context || label}
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs bg-[var(--blue-primary)] text-white max-w-[360px]">
                  <span className="truncate">{label}</span>
                  <button type="button" aria-label={`Remover ${label}`}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete?.(e); }}
                    className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-white/80 hover:text-white hover:bg-white/20 transition-colors">×</button>
                </span>
              );
            })
          }
          renderOption={(props, option) => (
            <li {...props} key={`${option.id}-${option.osmType ?? ""}-${option.osmId ?? ""}`}>
              <div className="py-1.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--text-primary)]">{option.label}</span>
                  {!option.hasExplicitName && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-300">Sem nome OSM</span>
                  )}
                </div>
                {option.subtitle && <p className="text-xs text-[var(--text-secondary)] mt-0.5 truncate">{option.subtitle}</p>}
                <p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                  {Number(option.lat).toFixed(5)}, {Number(option.long).toFixed(5)}
                  {option.osmType && option.osmId ? ` · OSM ${option.osmType}/${option.osmId}` : ""}
                </p>
                {option.debugReason && <p className="text-[11px] text-yellow-400 mt-0.5">{option.debugReason}</p>}
              </div>
            </li>
          )}
          renderInput={(params: any) => (
            <TextField {...params}
              placeholder={metaForm.locations.length < 1 ? "Nenhuma localidade selecionada" : ""}
              error={!!formErrors.locations}
              helperText={formErrors.locations}
              sx={autocompleteSx} />
          )}
        />
      </div>

      <Divider />

      <SectionTitle title="Posicionamentos" description="Escolha em quais plataformas e posicionamentos a campanha poderá rodar" />
      {formErrors.placements && <p className="text-xs text-red-500 mb-3">{formErrors.placements}</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {PLACEMENT_CATALOG.map((platform) => {
          const platformState = metaForm.generalInfos.placements[platform.key];
          return (
            <div key={platform.key} className="rounded-xl bg-[var(--bg-secondary)] p-4">
              <label className="flex items-center gap-2.5 cursor-pointer mb-3">
                <input type="checkbox" checked={platformState.enabled}
                  onChange={() => handleTogglePlatform(platform.key)}
                  className="w-4 h-4 accent-[var(--blue-primary)] rounded" />
                <span className="text-sm font-medium text-[var(--text-primary)]">{platform.label}</span>
              </label>
              <div className="grid grid-cols-2 gap-2 pl-6">
                {platform.positions.map((position) => (
                  <label key={`${platform.key}-${position.key}`}
                    className={`flex items-center gap-2 cursor-pointer ${!platformState.enabled ? "opacity-40" : ""}`}>
                    <input type="checkbox"
                      checked={!!platformState.positions[position.key as keyof typeof platformState.positions]}
                      disabled={!platformState.enabled}
                      onChange={() => handleTogglePosition(platform.key, position.key)}
                      className="w-3.5 h-3.5 accent-[var(--blue-primary)] rounded" />
                    <span className="text-xs text-[var(--text-secondary)]">{position.label}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PaidTrafficStep;
