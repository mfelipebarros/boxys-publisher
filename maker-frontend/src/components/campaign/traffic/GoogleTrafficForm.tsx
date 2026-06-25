import { Autocomplete, TextField, CircularProgress } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import type {
  GoogleCampaignMode,
  GoogleTrafficForm as GoogleTrafficFormData,
  GoogleRadiusUnit,
} from "../../../types/index.ts";
import {
  fetchGoogleLocations,
  fetchGoogleRadiusLocations,
  type GoogleLocationOption,
} from "../../../utils/GoogleLocationService.ts";

const GOOGLE_OBJECTIVES = [
  "Vendas", "Leads", "Tráfego do site",
  "Consideração de produto e marca", "Alcance e reconhecimento da marca", "Promoção de App",
];

const CAMPAIGN_NAME_MAX = 30;

type DemandGenAudiencePreset = { value: string; label: string };

const DEMAND_GEN_AUDIENCE_PRESETS: DemandGenAudiencePreset[] = [
  { value: "custom_audience_clients", label: "Base de clientes ativos" },
  { value: "custom_audience_converts_lookalike", label: "Lookalike de conversões (1%)" },
  { value: "custom_audience_site_visitors", label: "Visitantes do site (últimos 30 dias)" },
  { value: "custom_audience_engaged_leads", label: "Leads engajados recentemente" },
];

const GOOGLE_LEAD_FORM_CTA_OPTIONS = [
  "Saiba mais", "Solicitar contato", "Pedir proposta", "Agendar visita", "Fale conosco",
];

const GOOGLE_AUTOMATIC_BIDDING_STRATEGIES: Array<{
  value: NonNullable<GoogleTrafficFormData["bidding_strategy"]>;
  label: string;
}> = [
  { value: "maximize_conversions", label: "Maximizar conversões" },
  { value: "maximize_clicks", label: "Maximizar cliques" },
  { value: "maximize_conversion_value", label: "Maximizar o valor da conversão" },
  { value: "target_cpa", label: "CPA desejado" },
  { value: "manual_cpc", label: "CPC manual" },
  { value: "target_impression_share", label: "Parcela de impressões desejadas" },
];

const inputCls = "w-full rounded-lg border border-[var(--bg-tertiary)] px-3 py-2.5 text-sm bg-[var(--bg-secondary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--blue-primary)] transition-all";
const selectCls = "w-full rounded-lg border border-[var(--bg-tertiary)] px-3 py-2.5 text-sm bg-[var(--bg-secondary)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--blue-primary)] transition-all cursor-pointer";
const textareaCls = "w-full rounded-lg border border-[var(--bg-tertiary)] px-3 py-2.5 text-sm bg-[var(--bg-secondary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--blue-primary)] transition-all resize-none";

const Field = ({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-medium text-[var(--text-secondary)]">{label}</label>
    {children}
    {(error || hint) && <p className={`text-xs ${error ? "text-red-400" : "text-[var(--text-tertiary)]"}`}>{error || hint}</p>}
  </div>
);

const ToggleButtons = ({ options, value, onSelect }: { options: Array<{ value: string; label: string }>; value: string; onSelect: (v: string) => void }) => (
  <div className="flex flex-wrap gap-2">
    {options.map((opt) => (
      <button key={opt.value} type="button" onClick={() => onSelect(opt.value)}
        className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
          value === opt.value ? "bg-[var(--blue-primary)] text-white" : "border border-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        }`}>
        {opt.label}
      </button>
    ))}
  </div>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h4 className="text-sm font-semibold text-[var(--text-primary)]">{children}</h4>
);

const Divider = () => <div className="border-t border-[var(--bg-tertiary)]" />;

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
  "& .MuiInputBase-input::placeholder": { color: "var(--text-secondary) !important", opacity: 1 },
  "& .MuiAutocomplete-popupIndicator, & .MuiAutocomplete-clearIndicator": { color: "var(--text-secondary)" },
  "& .MuiFormHelperText-root": { color: "var(--text-tertiary)", fontSize: "0.7rem", marginLeft: 0 },
};

const autocompleteListboxSx = {
  backgroundColor: "var(--bg-secondary)",
  color: "var(--text-primary)",
  "& .MuiAutocomplete-option": {
    alignItems: "flex-start",
    backgroundColor: "var(--bg-secondary)",
    color: "var(--text-primary)",
    "&[aria-selected='true']": { backgroundColor: "rgba(0, 0, 0, 0.18)" },
    "&.Mui-focused, &:hover": { backgroundColor: "rgba(0, 122, 255, 0.12)" },
  },
  "& .MuiAutocomplete-noOptions": { color: "#fff", fontSize: "0.875rem" },
};

const autocompletePaperSx = {
  backgroundColor: "var(--bg-secondary)",
  border: "1px solid var(--bg-tertiary)",
};

interface GoogleTrafficFormProps {
  mode: GoogleCampaignMode;
  form: GoogleTrafficFormData;
  errors: Record<string, string>;
  onChange: (patch: Partial<GoogleTrafficFormData>) => void;
  userId?: string;
  campaignId?: number;
}

const GoogleTrafficFormComponent = ({ mode, form, errors, onChange }: GoogleTrafficFormProps) => {
  const isSearch = mode === "search";
  const isPMax = mode === "performance_max";
  const isDemandGen = mode === "demand_gen";

  const [locationInput, setLocationInput] = useState("");
  const [locationOptions, setLocationOptions] = useState<GoogleLocationOption[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [radiusInput, setRadiusInput] = useState("");
  const [radiusOptions, setRadiusOptions] = useState<GoogleLocationOption[]>([]);
  const [loadingRadiusLocations, setLoadingRadiusLocations] = useState(false);
  const [radiusSelected, setRadiusSelected] = useState<GoogleLocationOption | null>(null);
  const [radiusValue, setRadiusValue] = useState<number>(20);
  const [radiusUnit, setRadiusUnit] = useState<GoogleRadiusUnit>("km");

  const existingLocationIdByName = useMemo(() => {
    const map = new Map<string, string>();
    const names = (form.locations || "").split(",").map((s) => s.trim()).filter(Boolean);
    const ids = Array.isArray(form.location_ids) ? form.location_ids : [];
    names.forEach((name, index) => { const id = String(ids[index] || "").trim(); if (id) map.set(name, id); });
    return map;
  }, [form.locations, form.location_ids]);

  const selectedLocationObjects = useMemo(() => {
    if (!form.locations) return [];
    return form.locations.split(",").map((s) => s.trim()).filter(Boolean)
      .map((name) => ({ id: existingLocationIdByName.get(name) || "", name, type: "", canonicalName: "" }));
  }, [form.locations, existingLocationIdByName]);

  const locationMode = isDemandGen ? "location" : form.location_mode || "location";
  const radiusLocations = form.radius_locations || [];

  const plainLocations = useMemo(() => {
    if (!form.locations) return [];
    return form.locations.split(",").map((s) => s.trim()).filter(Boolean);
  }, [form.locations]);

  const parseList = (value?: string | null) => (value || "").split(/[\n,|]/).map((s) => s.trim()).filter(Boolean);
  const limitLines = (value: string, max: number) => value.split("\n").map((line) => line.slice(0, max)).join("\n");
  const sanitizeAudienceSignals = (value: string) =>
    value.split(/[\n,]/).map((item) => item.replace(/^["'""'']+|["'""'']+$/g, "").trim().slice(0, 80)).filter(Boolean).join("\n");

  const selectedDemandGenAudiences = useMemo(() => {
    const currentValues = parseList(form.custom_audiences);
    return DEMAND_GEN_AUDIENCE_PRESETS.filter((opt) => currentValues.includes(opt.value));
  }, [form.custom_audiences]);

  useEffect(() => {
    if (!isDemandGen || form.location_mode !== "radius") return;
    onChange({ location_mode: "location" });
    setRadiusInput(""); setRadiusSelected(null);
  }, [form.location_mode, isDemandGen, onChange]);

  useEffect(() => {
    if (!locationInput.trim()) { setLocationOptions([]); return; }
    const timer = setTimeout(async () => {
      setLoadingLocations(true);
      try { setLocationOptions(await fetchGoogleLocations(locationInput)); }
      catch { setLocationOptions([]); }
      finally { setLoadingLocations(false); }
    }, 500);
    return () => clearTimeout(timer);
  }, [locationInput]);

  useEffect(() => {
    if (!radiusInput.trim()) { setRadiusOptions([]); return; }
    const timer = setTimeout(async () => {
      setLoadingRadiusLocations(true);
      try { setRadiusOptions(await fetchGoogleRadiusLocations(radiusInput)); }
      catch { setRadiusOptions([]); }
      finally { setLoadingRadiusLocations(false); }
    }, 500);
    return () => clearTimeout(timer);
  }, [radiusInput]);

  const handleLocationsChange = (_: unknown, newValue: (string | GoogleLocationOption)[]) => {
    const options = newValue.map((item) => {
      if (typeof item === "string") { const name = item.trim(); if (!name) return null; return { id: existingLocationIdByName.get(name) || "", name }; }
      const name = String(item.name || "").trim(); if (!name) return null;
      const id = String(item.id || "").trim() || existingLocationIdByName.get(name) || "";
      return { ...item, id, name };
    }).filter((item): item is GoogleLocationOption => !!item);
    const locationIds = options.map((o) => String(o.id || "").trim()).filter((id): id is string => !!id);
    onChange({ locations: options.map((o) => o.name).join(", "), location_ids: locationIds.length > 0 ? locationIds : undefined });
  };

  const handleAddRadiusLocation = () => {
    const name = (radiusSelected?.name || radiusInput).trim();
    if (!name) return;
    const radius = Number(radiusValue);
    if (!Number.isFinite(radius) || radius <= 0) return;
    if (radiusLocations.some((item) => item.name === name && item.radius === radius && item.unit === radiusUnit)) return;
    onChange({ radius_locations: [...radiusLocations, { id: radiusSelected?.id, name, canonicalName: radiusSelected?.canonicalName, radius, unit: radiusUnit }] });
    setRadiusInput(""); setRadiusSelected(null);
  };

  const handleRemoveRadiusLocation = (index: number) => onChange({ radius_locations: radiusLocations.filter((_, idx) => idx !== index) });
  const handleRemovePlainLocation = (index: number) => {
    const nextLocations = plainLocations.filter((_, idx) => idx !== index);
    const nextIds = form.location_ids?.filter((_, idx) => idx !== index);
    onChange({ locations: nextLocations.join(", "), location_ids: nextIds && nextIds.length > 0 ? nextIds : undefined });
  };

  const renderLocationOption = (props: React.HTMLAttributes<HTMLLIElement>, option: string | GoogleLocationOption) => {
    if (typeof option === "string") return <li {...props}>{option}</li>;
    const typeMap: Record<string, string> = { City: "Cidade", State: "Estado", Country: "País", District: "Bairro", Neighborhood: "Bairro", Municipality: "Município", Region: "Região", Airport: "Aeroporto", University: "Universidade" };
    const canonicalName = option.canonicalName?.replace(/,(?=\S)/g, ", ");
    return (
      <li {...props} key={option.id}>
        <div className="flex flex-col">
          <span className="font-medium text-[var(--text-primary)]">{option.name}</span>
          <span className="text-xs text-[var(--text-secondary)]">{typeMap[option.type || ""] || option.type || "Local"} — {canonicalName}</span>
        </div>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* OBJETIVO */}
      <div>
        <p className="text-xs font-medium text-[var(--text-secondary)] mb-3">Objetivo da Campanha</p>
        <div className="flex flex-wrap gap-2">
          {GOOGLE_OBJECTIVES.map((option) => (
            <button key={option} type="button" onClick={() => onChange({ objective: option })}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                form.objective === option ? "bg-[var(--blue-primary)] text-white" : "border border-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              }`}>{option}</button>
          ))}
        </div>
      </div>

      <Divider />

      {/* INFORMAÇÕES BÁSICAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nome da Campanha" error={errors.campaign_name} hint={`${(form.campaign_name || "").length}/${CAMPAIGN_NAME_MAX} caracteres`}>
          <input className={inputCls} value={form.campaign_name || ""} maxLength={CAMPAIGN_NAME_MAX}
            onChange={(e) => onChange({ campaign_name: e.target.value.slice(0, CAMPAIGN_NAME_MAX) })} />
        </Field>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-[var(--text-secondary)]">Segmentação de local</span>
            {isDemandGen ? (
              <span className="rounded-full bg-[var(--blue-primary)] px-4 py-1.5 text-xs font-semibold text-white">Local</span>
            ) : (
              <ToggleButtons
                options={[{ value: "location", label: "Local" }, { value: "radius", label: "Raio" }]}
                value={locationMode}
                onSelect={(v) => onChange({ location_mode: v as "location" | "radius" })}
              />
            )}
          </div>

          {locationMode === "location" ? (
            <Field label="Localização (Geotargeting)" hint="Busque bairros de São Paulo ou municípios permitidos.">
              <Autocomplete
                multiple options={locationOptions} sx={autocompleteSx}
                slotProps={{ paper: { sx: autocompletePaperSx }, listbox: { sx: autocompleteListboxSx } }}
                getOptionLabel={(option: any) => typeof option === "string" ? option : `${option.name}${option.type ? ` (${option.type})` : ""}`}
                value={selectedLocationObjects} onChange={handleLocationsChange}
                onInputChange={(_: any, v: string) => setLocationInput(v)}
                loading={loadingLocations} filterSelectedOptions noOptionsText="Digite um bairro ou município permitido"
                // @ts-ignore renderTags not in MUI v9 types
                renderTags={() => null} renderOption={renderLocationOption}
                renderInput={(params: any) => (
                  <TextField {...params} placeholder="Ex: São Paulo, Brasil" sx={autocompleteSx}
                    slotProps={{ input: { ...(params.slotProps?.input as object), endAdornment: (<>{loadingLocations && <CircularProgress color="inherit" size={16} sx={{ color: "var(--text-secondary)" }} />}{(params.slotProps?.input as any)?.endAdornment}</>) } }}
                  />
                )}
              />
            </Field>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 md:grid-cols-[1fr_100px_90px_auto] gap-2 items-end">
                <Field label="Local para o raio" hint="Busque um local para o raio.">
                  <Autocomplete sx={autocompleteSx} slotProps={{ paper: { sx: autocompletePaperSx }, listbox: { sx: autocompleteListboxSx } }}
                    getOptionLabel={(option) => typeof option === "string" ? option : option.canonicalName || option.name}
                    freeSolo options={radiusOptions} value={radiusSelected} inputValue={radiusInput}
                    onChange={(_, newValue) => {
                      if (typeof newValue === "string") { setRadiusSelected(null); setRadiusInput(newValue); return; }
                      setRadiusSelected(newValue); setRadiusInput(newValue?.name || "");
                    }}
                    onInputChange={(_, v, reason) => { if (reason === "input") setRadiusSelected(null); setRadiusInput(v); }}
                    loading={loadingRadiusLocations} noOptionsText="Digite para buscar locais" renderOption={renderLocationOption}
                    renderInput={(params) => (
                      <TextField {...params} placeholder="Ex: São Paulo" sx={autocompleteSx}
                        slotProps={{ input: { ...(params.slotProps?.input as object), endAdornment: (<>{loadingRadiusLocations && <CircularProgress color="inherit" size={16} sx={{ color: "var(--text-secondary)" }} />}{(params.slotProps?.input as any)?.endAdornment}</>) } }}
                      />
                    )}
                  />
                </Field>
                <Field label="Raio">
                  <input type="number" className={inputCls} value={radiusValue} min={1} onChange={(e) => setRadiusValue(Number(e.target.value))} />
                </Field>
                <Field label="Unidade">
                  <select className={selectCls} value={radiusUnit} onChange={(e) => setRadiusUnit(e.target.value as GoogleRadiusUnit)}>
                    <option value="km">km</option>
                    <option value="mi">mi</option>
                  </select>
                </Field>
                <button type="button" onClick={handleAddRadiusLocation}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium border border-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-white/20 transition-colors">
                  Adicionar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Locations list */}
      {(plainLocations.length > 0 || radiusLocations.length > 0) && (
        <div className="rounded-lg bg-[var(--bg-secondary)] border border-[var(--bg-tertiary)] p-3 flex flex-col gap-2">
          {radiusLocations.map((item, index) => (
            <div key={`radius-${item.name}-${index}`} className="flex items-center justify-between gap-2">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-[var(--text-primary)]">{item.radius} {item.unit} ao redor de {item.canonicalName || item.name}</span>
                <span className="text-xs text-[var(--text-tertiary)]">{item.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--text-tertiary)]">Raio</span>
                <button type="button" onClick={() => handleRemoveRadiusLocation(index)} className="text-xs text-red-400 hover:text-red-300 transition-colors">Remover</button>
              </div>
            </div>
          ))}
          {plainLocations.map((name, index) => (
            <div key={`loc-${name}-${index}`} className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-[var(--text-primary)]">{name}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--text-tertiary)]">Local</span>
                <button type="button" onClick={() => handleRemovePlainLocation(index)} className="text-xs text-red-400 hover:text-red-300 transition-colors">Remover</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Divider />

      {/* SEARCH */}
      {isSearch && (
        <div className="flex flex-col gap-4">
          <SectionTitle>Configuração de Pesquisa</SectionTitle>
          <div className="bg-[var(--bg-secondary)] rounded-xl p-4 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-[var(--text-secondary)]">Modo de Lance</span>
              <ToggleButtons
                options={[{ value: "automatic", label: "Automático" }, { value: "manual", label: "Manual" }]}
                value={form.bidding_mode === "manual" ? "manual" : "automatic"}
                onSelect={(v) => onChange(v === "manual" ? { bidding_mode: "manual", bidding_strategy: "manual_cpc" } : { bidding_mode: "automatic", bidding_strategy: form.bidding_strategy || "maximize_clicks" })}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Estratégia de Lances" hint={form.bidding_mode === "manual" ? "Lance manual usa CPC manual." : "Escolha uma estratégia automática."}>
                <select className={selectCls} disabled={form.bidding_mode === "manual"}
                  value={form.bidding_mode === "manual" ? "manual_cpc" : form.bidding_strategy || "maximize_clicks"}
                  onChange={(e) => onChange({ bidding_strategy: e.target.value as GoogleTrafficFormData["bidding_strategy"] })}>
                  {form.bidding_mode === "manual" ? <option value="manual_cpc">CPC manual</option> :
                    GOOGLE_AUTOMATIC_BIDDING_STRATEGIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </Field>
              <div className="flex flex-col gap-2 bg-[var(--bg-tertiary)] rounded-lg p-3">
                <span className="text-xs font-medium text-[var(--text-secondary)]">Rede de Display</span>
                <ToggleButtons options={[{ value: "false", label: "Desativada" }, { value: "true", label: "Ativada" }]}
                  value={form.display_network_enabled ? "true" : "false"}
                  onSelect={(v) => onChange({ display_network_enabled: v === "true" })} />
                <span className="text-xs text-[var(--text-tertiary)]">Padrão: desativada.</span>
              </div>
              <div className="flex flex-col gap-2 bg-[var(--bg-tertiary)] rounded-lg p-3">
                <span className="text-xs font-medium text-[var(--text-secondary)]">Parceiros de Pesquisa</span>
                <ToggleButtons options={[{ value: "false", label: "Desativados" }, { value: "true", label: "Ativados" }]}
                  value={form.search_partners_enabled ? "true" : "false"}
                  onSelect={(v) => onChange({ search_partners_enabled: v === "true" })} />
                <span className="text-xs text-[var(--text-tertiary)]">Padrão: desativados.</span>
              </div>
            </div>
          </div>
          <Field label="Palavras-chave (Keywords)" error={errors.keywords} hint="Uma palavra-chave por linha.">
            <textarea className={textareaCls} rows={4} value={form.keywords || ""}
              placeholder={"comprar apartamento\napartamento centro sp\nfinanciamento imobiliário"}
              onChange={(e) => onChange({ keywords: e.target.value })} />
          </Field>
          <Field label="Palavras-chave Negativas" hint="Termos para NÃO mostrar o anúncio.">
            <textarea className={textareaCls} rows={3} value={form.negative_keywords || ""}
              placeholder={"grátis\naluguel\nemprego"} onChange={(e) => onChange({ negative_keywords: e.target.value })} />
          </Field>
          <div className="bg-[var(--bg-secondary)] rounded-xl p-4 flex flex-col gap-4">
            <SectionTitle>Extensões de Anúncio</SectionTitle>
            <Field label="Site Links" error={errors.sitelinks} hint="Cadastre no mínimo 4 site links, um por linha.">
              <textarea className={textareaCls} rows={4} value={form.sitelinks || ""}
                placeholder={"Simule seu financiamento\nAgende sua visita\nConheça o decorado\nFale com um consultor"}
                onChange={(e) => onChange({ sitelinks: e.target.value })} />
            </Field>
            <Field label="Frases de Destaque (Callouts)" error={errors.callouts} hint="Uma frase por linha.">
              <textarea className={textareaCls} rows={3} value={form.callouts || ""}
                placeholder={"Atendimento imediato\nEntrada facilitada\nUse seu FGTS"}
                onChange={(e) => onChange({ callouts: e.target.value })} />
            </Field>
            <Field label="Snippets Estruturados" error={errors.structured_snippet} hint="Uma linha por snippet.">
              <textarea className={textareaCls} rows={3} value={form.structured_snippet || ""}
                placeholder={"Serviços: Compra, Venda, Locação\nBairros: Moema, Pinheiros, Vila Mariana"}
                onChange={(e) => onChange({ structured_snippet: e.target.value })} />
            </Field>
            <div className="flex flex-col gap-3 bg-[var(--bg-tertiary)] rounded-lg p-3">
              <span className="text-xs font-medium text-[var(--text-secondary)]">Formulário de Lead</span>
              <ToggleButtons options={[{ value: "false", label: "Desativado" }, { value: "true", label: "Ativado" }]}
                value={form.lead_form_enabled ? "true" : "false"}
                onSelect={(v) => onChange({ lead_form_enabled: v === "true" })} />
              <span className="text-xs text-[var(--text-tertiary)]">Ative quando quiser gerar leads diretamente pelo anúncio.</span>
            </div>
            {form.lead_form_enabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="CTA do Formulário">
                  <select className={selectCls} value={form.lead_form_cta || "Saiba mais"} onChange={(e) => onChange({ lead_form_cta: e.target.value })}>
                    {GOOGLE_LEAD_FORM_CTA_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </Field>
                <Field label="Título do Formulário" error={errors.lead_form_headline}>
                  <input className={inputCls} value={form.lead_form_headline || ""} onChange={(e) => onChange({ lead_form_headline: e.target.value })} />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Descrição do Formulário" error={errors.lead_form_description}>
                    <textarea className={textareaCls} rows={3} value={form.lead_form_description || ""} onChange={(e) => onChange({ lead_form_description: e.target.value })} />
                  </Field>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PERFORMANCE MAX & DEMAND GEN */}
      {(isPMax || isDemandGen) && (
        <div className="flex flex-col gap-4">
          <SectionTitle>{isPMax ? "Performance Max — Sinais de Audiência" : "Demand Gen — Segmentação"}</SectionTitle>
          <Field label="Sitelinks" error={errors.sitelinks} hint="Cadastre no mínimo 4 site links, um por linha.">
            <textarea className={textareaCls} rows={4} value={form.sitelinks || ""}
              placeholder={"Simule seu financiamento\nFale com um especialista\nConheça os imóveis disponíveis"}
              onChange={(e) => onChange({ sitelinks: e.target.value })} />
          </Field>
          <Field label="Frases de Destaque (Callouts)" error={errors.callouts} hint="Uma frase por linha.">
            <textarea className={textareaCls} rows={3} value={form.callouts || ""}
              placeholder={"Atendimento imediato\nEntrada facilitada\nUse seu FGTS"}
              onChange={(e) => onChange({ callouts: e.target.value })} />
          </Field>
          <Field label="Snippets Estruturados" error={errors.structured_snippet} hint="Uma linha por snippet.">
            <textarea className={textareaCls} rows={3} value={form.structured_snippet || ""}
              placeholder={"Serviços: Compra, Venda, Locação\nBairros: Moema, Pinheiros, Vila Mariana"}
              onChange={(e) => onChange({ structured_snippet: e.target.value })} />
          </Field>
          <div className="flex flex-col gap-3 bg-[var(--bg-secondary)] rounded-xl p-4">
            <span className="text-xs font-medium text-[var(--text-secondary)]">Formulário de Lead</span>
            <ToggleButtons options={[{ value: "false", label: "Desativado" }, { value: "true", label: "Ativado" }]}
              value={form.lead_form_enabled ? "true" : "false"}
              onSelect={(v) => onChange({ lead_form_enabled: v === "true" })} />
            <span className="text-xs text-[var(--text-tertiary)]">Ative quando quiser gerar leads diretamente pelo anúncio.</span>
          </div>
          {form.lead_form_enabled && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="CTA do Formulário">
                <select className={selectCls} value={form.lead_form_cta || "Saiba mais"} onChange={(e) => onChange({ lead_form_cta: e.target.value })}>
                  {GOOGLE_LEAD_FORM_CTA_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </Field>
              <Field label="Título do Formulário" error={errors.lead_form_headline}>
                <input className={inputCls} value={form.lead_form_headline || ""} onChange={(e) => onChange({ lead_form_headline: e.target.value })} />
              </Field>
              <div className="md:col-span-2">
                <Field label="Descrição do Formulário" error={errors.lead_form_description}>
                  <textarea className={textareaCls} rows={3} value={form.lead_form_description || ""} onChange={(e) => onChange({ lead_form_description: e.target.value })} />
                </Field>
              </div>
            </div>
          )}
          <Field label="Sinais de Audiência (Audience Signals)" error={errors.audience_signals}
            hint="Separe por vírgula ou quebra de linha. Aspas serão removidas automaticamente.">
            <textarea className={textareaCls} rows={4} value={form.audience_signals || ""}
              placeholder="Ex: apartamentos na planta, decorado, Lopes Imobiliária, Quinto Andar"
              onChange={(e) => onChange({ audience_signals: sanitizeAudienceSignals(e.target.value) })} />
          </Field>
          <Field label="Palavras-chave Negativas" hint="Uma por linha.">
            <textarea className={textareaCls} rows={3} value={form.negative_keywords || ""}
              placeholder={"grátis\nemprego\ncurso\nmarketing digital"}
              onChange={(e) => onChange({ negative_keywords: e.target.value })} />
          </Field>
          {isDemandGen && (
            <Field label="Públicos Personalizados / Lookalike" hint="Escolha 1 ou mais públicos pré-configurados.">
              <Autocomplete multiple options={DEMAND_GEN_AUDIENCE_PRESETS} getOptionLabel={(option) => option.label}
                value={selectedDemandGenAudiences}
                onChange={(_, newValue) => onChange({ custom_audiences: newValue.map((opt) => opt.value).join("\n") })}
                sx={autocompleteSx} slotProps={{ paper: { sx: autocompletePaperSx }, listbox: { sx: autocompleteListboxSx } }}
                renderInput={(params) => <TextField {...params} placeholder="Selecione públicos..." sx={autocompleteSx} />}
              />
            </Field>
          )}
        </div>
      )}

      <Divider />

      {/* CRIATIVOS */}
      <div className="flex flex-col gap-4">
        <SectionTitle>Anúncios (Textos)</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Títulos Curtos (Headlines)" hint="Mínimo 3, Máximo 15. Até 30 caracteres cada. Separe por quebra de linha.">
            <textarea className={textareaCls} rows={4} value={form.titles || ""}
              placeholder={"Apartamento Centro SP\nFinanciamento Facilitado\nVisite Decorado"}
              onChange={(e) => onChange({ titles: limitLines(e.target.value, 30) })} />
          </Field>
          <Field label="Descrições" hint="Mínimo 2, Máximo 4. Até 90 caracteres cada.">
            <textarea className={textareaCls} rows={4} value={form.descriptions || ""}
              placeholder="More no centro com todo conforto. Entrada facilitada em até 60x."
              onChange={(e) => onChange({ descriptions: limitLines(e.target.value, 90) })} />
          </Field>
        </div>
        {(isPMax || isDemandGen) && (
          <Field label="Títulos Longos (Long Headlines)" hint="Até 90 caracteres. Aparece quando há mais espaço.">
            <textarea className={textareaCls} rows={3} value={form.long_titles || ""}
              placeholder="Seu novo apartamento no centro de SP espera por você"
              onChange={(e) => onChange({ long_titles: limitLines(e.target.value, 90) })} />
          </Field>
        )}
      </div>

      <Divider />

      {/* ORÇAMENTO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Orçamento Diário (R$)" error={errors.budget} hint="Valor gasto por dia.">
          <input type="number" className={inputCls} value={form.budget || ""} min={1}
            onChange={(e) => onChange({ budget: Number(e.target.value) })} />
        </Field>
        <Field label="Duração da Campanha (dias)" error={errors.duration_days}
          hint="A campanha começa hoje e termina automaticamente conforme a duração.">
          <input type="number" className={inputCls} value={form.duration_days ?? ""} min={1}
            onChange={(e) => onChange({ duration_days: e.target.value === "" ? undefined : Number(e.target.value) })} />
        </Field>
      </div>
    </div>
  );
};

export default GoogleTrafficFormComponent;
