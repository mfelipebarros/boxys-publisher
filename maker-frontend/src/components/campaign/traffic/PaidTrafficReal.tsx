import React, { useEffect, useRef, useState } from "react";
import { randomUUID } from "../../../utils/uuid";
import { Globe, Search, ChevronLeft, ChevronRight } from "lucide-react";
import type {
  GoogleCampaignMode,
  GoogleTrafficForm as GoogleTrafficFormType,
  PaidTrafficInfoComplete,
  PaidTrafficStepHandle,
  Placements, AudienceGroup,
} from "../../../types/index.ts";
import GoogleTrafficFormComponent from "./GoogleTrafficForm";
import PaidTrafficStep from "./PaidTrafficStep";
import {
  normalizeCampaignDurationDays,
} from "../../../utils/googleCampaignDates";

type PlatformTab = "meta" | "google";

const initialGoogleFormState: GoogleTrafficFormType = {
  campaign_name: "",
  business_name: "",
  objective: "Leads",
  final_url: "",
  bidding_mode: "automatic",
  bidding_strategy: "maximize_clicks",
  display_network_enabled: false,
  search_partners_enabled: false,
  keywords: "",
  negative_keywords: "",
  locations: "",
  location_ids: [],
  location_mode: "location",
  radius_locations: [],
  sitelinks: "",
  callouts: "",
  structured_snippet: "",
  lead_form_enabled: false,
  lead_form_cta: "Saiba mais",
  lead_form_headline: "",
  lead_form_description: "",
  audience_signals: "",
  custom_audiences: "",
  titles: "",
  long_titles: "",
  descriptions: "",
  budget: 0,
  duration_days: 30,
};

export const createDefaultPlacements = (): Placements => ({
  facebook: {
    enabled: true,
    positions: { feed: true, stories: true, reels: true },
  },
  instagram: {
    enabled: true,
    positions: { feed: true, stories: true, reels: true, explore: true },
  },
  audienceNetwork: {
    enabled: true,
    positions: { native: true, banner: true, interstitial: true },
  },
  whatsapp: {
    enabled: true,
    positions: { status: true },
  },
  threads: {
    enabled: true,
    positions: { feed: true },
  },
});

const stripScheduleFields = (
  form: GoogleTrafficFormType
): GoogleTrafficFormType => {
  const { start_date: _startDate, end_date: _endDate, ...rest } = form;
  return rest;
};

const createAudienceGroup = (label: string): AudienceGroup => ({
  id: randomUUID(),
  label,
  items: [],
});

interface PaidTrafficRealProps {
  onNextStep: () => void;
  onPreviousStep: () => void;
  onSubmit: (
    paidTrafficInfos: PaidTrafficInfoComplete,
    oldPaidTraffics?: PaidTrafficInfoComplete
  ) => void;
  initialData?: PaidTrafficInfoComplete;
  userId?: string;
  campaignId?: number;
}

const PaidTrafficReal: React.FC<PaidTrafficRealProps> = ({
  onNextStep,
  onPreviousStep,
  onSubmit,
  initialData,
  userId,
  campaignId,
}) => {
  const [activePlatform, setActivePlatform] = useState<PlatformTab>("meta");
  const [activeGoogleMode, setActiveGoogleMode] = useState<GoogleCampaignMode>("search");

  const metaFormRef = useRef<PaidTrafficStepHandle | null>(null);
  const [metaForm, setMetaForm] = useState<PaidTrafficInfoComplete>({
    generalInfos: {
      objective: "OUTCOME_LEADS",
      gender: "all",
      budget: 600,
      min_age: 18,
      max_age: 65,
      placements: createDefaultPlacements(),
    },
    audienceGroups: [
      createAudienceGroup(
        "Incluir pessoas que correspondam a pelo menos UM dos seguintes"
      ),
    ],
    locations: [],
  });

  const [googleForms, setGoogleForms] = useState<{
    search: GoogleTrafficFormType;
    performance_max: GoogleTrafficFormType;
    demand_gen: GoogleTrafficFormType;
  }>({
    search: { ...initialGoogleFormState },
    performance_max: { ...initialGoogleFormState },
    demand_gen: { ...initialGoogleFormState },
  });

  const [googleErrors, setGoogleErrors] = useState<Record<string, string>>({});
  const [hasPendingSync, setHasPendingSync] = useState(false);

  const withNormalizedDuration = (
    form: GoogleTrafficFormType
  ): GoogleTrafficFormType => {
    const normalizedBiddingMode =
      form.bidding_mode ??
      (form.bidding_strategy === "manual_cpc" ? "manual" : "automatic");

    if (Number(form.duration_days) > 0) {
      return { ...form, bidding_mode: normalizedBiddingMode };
    }

    const start = form.start_date ? new Date(`${form.start_date}T00:00:00`) : null;
    const end = form.end_date ? new Date(`${form.end_date}T00:00:00`) : null;

    let derivedDuration: number | undefined;
    if (start && end && Number.isFinite(start.getTime()) && Number.isFinite(end.getTime())) {
      const diffDays = Math.floor(
        (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      );
      derivedDuration = Math.max(diffDays + 1, 1);
    }

    return {
      ...form,
      bidding_mode: normalizedBiddingMode,
      duration_days: normalizeCampaignDurationDays(derivedDuration),
    };
  };

  useEffect(() => {
    if (initialData) {
      setMetaForm({
        generalInfos: { ...initialData.generalInfos },
        audienceGroups: initialData.audienceGroups?.length
          ? initialData.audienceGroups
          : [createAudienceGroup("Incluir pessoas que correspondam a pelo menos UM dos seguintes")],
        locations: initialData.locations || [],
      });

      if (initialData.googleInfo) {
        const gInfo = initialData.googleInfo;
        if (gInfo.activeType) setActiveGoogleMode(gInfo.activeType);
        setGoogleForms((prev) => ({
          search: withNormalizedDuration({ ...prev.search, ...(gInfo.search || {}) }),
          performance_max: withNormalizedDuration({ ...prev.performance_max, ...(gInfo.performance_max || {}) }),
          demand_gen: withNormalizedDuration({ ...prev.demand_gen, ...(gInfo.demand_gen || {}) }),
        }));
      }
    }
  }, [initialData]);

  const buildPayload = (): PaidTrafficInfoComplete => ({
    generalInfos: metaForm.generalInfos,
    audienceGroups: metaForm.audienceGroups,
    locations: metaForm.locations,
    googleInfo: {
      activeType: activeGoogleMode,
      search: stripScheduleFields(googleForms.search),
      performance_max: stripScheduleFields(googleForms.performance_max),
      demand_gen: stripScheduleFields(googleForms.demand_gen),
    },
  });

  useEffect(() => {
    if (!hasPendingSync) return;
    onSubmit(buildPayload(), initialData);
    setHasPendingSync(false);
  }, [hasPendingSync, initialData, onSubmit, activeGoogleMode, googleForms, metaForm]);

  const updateGoogleForm = (patch: Partial<GoogleTrafficFormType>) => {
    setGoogleForms((prev) => ({
      ...prev,
      [activeGoogleMode]: { ...prev[activeGoogleMode], ...patch },
    }));
    setHasPendingSync(true);
  };

  const handleNext = () => {
    const isValidMeta = metaFormRef.current?.validate() ?? false;
    if (!isValidMeta) {
      setActivePlatform("meta");
      return;
    }
    setGoogleErrors({});
    onSubmit(buildPayload(), initialData);
    onNextStep();
  };

  const googleModeLabels: Record<GoogleCampaignMode, string> = {
    search: "Rede de Pesquisa",
    performance_max: "Performance Max",
    demand_gen: "Demand Gen",
  };

  return (
    <div className="space-y-4">
      {/* Platform selector */}
      <div className="bg-[rgb(17_18_20)] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[var(--bg-tertiary)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Plataforma</h3>
          <p className="text-xs text-[var(--text-tertiary)] mt-0.5">Selecione onde deseja anunciar</p>
        </div>
        <div className="p-6 flex gap-3">
          <button
            type="button"
            onClick={() => setActivePlatform("meta")}
            className={`flex items-center gap-3 px-5 py-3 rounded-xl transition-all text-sm font-medium ${
              activePlatform === "meta"
                ? "bg-gradient-to-b from-[#dbeafe] to-white text-[#1d4ed8]"
                : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Globe size={18} />
            <div className="text-left">
              <p className="font-semibold leading-tight">Meta Ads</p>
              <p className="text-xs opacity-70 font-normal mt-0.5">Facebook & Instagram</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setActivePlatform("google")}
            className={`flex items-center gap-3 px-5 py-3 rounded-xl transition-all text-sm font-medium ${
              activePlatform === "google"
                ? "bg-gradient-to-br from-[#d1fae5] via-white to-[#fef3c7] text-[#065f46]"
                : "bg-[var(--bg-secondary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            }`}
          >
            <Search size={18} />
            <div className="text-left">
              <p className="font-semibold leading-tight">Google Ads</p>
              <p className="text-xs opacity-70 font-normal mt-0.5">Pesquisa, YouTube, Discovery</p>
            </div>
          </button>
        </div>
      </div>

      {/* Meta Ads content */}
      <div style={{ display: activePlatform === "meta" ? "block" : "none" }}>
        <div className="bg-[rgb(17_18_20)] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--bg-tertiary)]">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Configuração Meta Ads</h3>
          </div>
          <div className="p-6">
            <PaidTrafficStep
              metaForm={metaForm}
              onChangeInfos={(infos) => {
                setMetaForm(infos);
                setHasPendingSync(true);
              }}
              innerRef={metaFormRef}
              adsForMeta={{ ads: [], isEditing: true }}
              onChangeAdsDestiny={() => {}}
            />
          </div>
        </div>
      </div>

      {/* Google Ads content */}
      <div style={{ display: activePlatform === "google" ? "block" : "none" }}>
        <div className="bg-[rgb(17_18_20)] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--bg-tertiary)] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Configuração Google Ads</h3>
            <div className="flex gap-0.5 bg-[var(--bg-secondary)] p-1 rounded-lg">
              {(["search", "performance_max", "demand_gen"] as GoogleCampaignMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    setActiveGoogleMode(mode);
                    setGoogleErrors({});
                  }}
                  className={`px-3 py-1.5 text-xs rounded-md transition-all font-medium ${
                    activeGoogleMode === mode
                      ? "bg-[var(--text-primary)] text-[var(--bg-primary)] shadow"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {googleModeLabels[mode]}
                </button>
              ))}
            </div>
          </div>
          <div className="p-6">
            <GoogleTrafficFormComponent
              mode={activeGoogleMode}
              form={googleForms[activeGoogleMode]}
              errors={googleErrors}
              onChange={updateGoogleForm}
              userId={userId}
              campaignId={campaignId}
            />
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onPreviousStep}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium border border-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-white/20 transition-colors"
        >
          <ChevronLeft size={15} />
          Voltar
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold bg-[var(--blue-primary)] text-white hover:bg-[var(--blue-dark)] transition-colors"
        >
          Continuar
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
};

export default PaidTrafficReal;
