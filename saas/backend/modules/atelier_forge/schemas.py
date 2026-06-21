import uuid
from datetime import datetime
from pydantic import BaseModel, Field


class ForgeIngestRequest(BaseModel):
    """Charge utile poussée par le serveur PXE après audit / effacement.

    `audit` et `certificate` sont des dicts BRUTS (formats Linux ou WinPE) :
    le pont les normalise et conserve l'original dans le stock.
    """
    audit: dict = {}
    certificate: dict = {}


class ForgeIngestResponse(BaseModel):
    stock_item_id: uuid.UUID
    serial_number: str | None
    grade: str | None
    created: bool  # True si nouvelle machine, False si mise à jour
    has_certificate: bool


class ForgePxeAsset(BaseModel):
    key: str
    label: str
    status: str
    detail: str
    url: str | None = None


class ForgePxeServiceCheck(BaseModel):
    key: str
    label: str
    status: str
    detail: str
    endpoint: str


class ForgePxeClient(BaseModel):
    id: str
    stock_item_id: uuid.UUID | None = None
    hostname: str | None = None
    ip: str | None = None
    mac: str | None = None
    serial_number: str | None = None
    brand: str | None = None
    model: str | None = None
    state: str
    boot_mode: str | None = None
    current_task: str | None = None
    progress: int | None = None
    last_seen: str | None = None
    remote_url: str | None = None
    notes: str | None = None
    capabilities: list[str] = Field(default_factory=list)


class ForgePxeStatus(BaseModel):
    server_ip: str
    server_url: str
    smb_share: str
    mode: str
    diagnostic: str
    assets: list[ForgePxeAsset]
    services: list[ForgePxeServiceCheck] = Field(default_factory=list)
    clients: list[ForgePxeClient]


class ForgePxeAuditDisk(BaseModel):
    text: str | None = None
    model: str | None = None
    serial_number: str | None = None
    size_gb: float | None = None
    type: str | None = None
    smart: str | None = None


class ForgePxeAuditBattery(BaseModel):
    name: str | None = None
    status: str | None = None
    health_percent: float | None = None
    wear_percent: float | None = None
    cycle_count: str | None = None
    label: str | None = None


class ForgePxeAuditPruneRequest(BaseModel):
    keep_latest: int = 50
    dry_run: bool = True


class ForgePxeAuditPruneResponse(BaseModel):
    dry_run: bool
    keep_latest: int
    candidates: int
    deleted_files: list[str]
    message: str


class ForgePxeAuditSummary(BaseModel):
    id: str
    filename: str
    created_at: str | None = None
    updated_at: str
    serial_number: str | None = None
    brand: str | None = None
    model: str | None = None
    cpu: str | None = None
    ram: str | None = None
    ram_mb: int | None = None
    main_disk: str | None = None
    battery_status: str | None = None
    grade_proposed: str | None = None
    ip: str | None = None
    mac: str | None = None
    usb_ports_detected: int | None = None
    disks: list[ForgePxeAuditDisk] = Field(default_factory=list)
    battery: list[ForgePxeAuditBattery] = Field(default_factory=list)
    label_lines: list[str] = Field(default_factory=list)
    raw: dict = Field(default_factory=dict)


class ForgePxeConfig(BaseModel):
    server_ip: str = "192.168.1.57"
    server_url: str = "http://192.168.1.57:1950"
    smb_share: str = r"\\192.168.1.57\deploy"
    mode: str = "proxy DHCP"
    tftp_port: int = 69
    http_port: int = 1950
    dhcp_proxy_port: int = 4011
    winpe_ready: bool = False


class ForgePxeConfigUpdate(BaseModel):
    server_ip: str | None = None
    server_url: str | None = None
    smb_share: str | None = None
    mode: str | None = None
    tftp_port: int | None = None
    http_port: int | None = None
    dhcp_proxy_port: int | None = None
    winpe_ready: bool | None = None


class ForgeNetworkResyncResponse(BaseModel):
    server_ip: str
    server_url: str
    smb_share: str
    restarted_services: list[str]
    message: str


class ForgeNetworkDiagnosticResponse(BaseModel):
    configured_ip: str
    detected_ip: str
    ip_matches: bool
    server_url: str
    smb_share: str
    deploy_dirs: dict[str, bool]
    services: list[ForgePxeServiceCheck]
    recommendation: str
    message: str


class ForgeSystemReportResponse(BaseModel):
    generated_at: str
    pxe_config: ForgePxeConfig
    network: ForgeNetworkDiagnosticResponse
    media_total: int
    wim_images_total: int
    wim_recipes_total: int
    wim_builds_total: int
    driver_packs_total: int
    unattend_profiles_total: int
    audits_total_visible: int
    backups_total: int
    recommendations: list[str]
    message: str


class ForgeWimRecipeCreate(BaseModel):
    name: str = "Windows 11 Pro - client"
    windows_iso_path: str = r"C:\AOS\ISO\windows.iso"
    work_dir: str = r"C:\AOS\WIM"
    output_wim_path: str = r"C:\AOS\Output\install-custom.wim"
    image_index: int = 1
    driver_path: str = r"C:\AOS\Drivers"
    include_drivers: bool = True
    enable_dotnet35: bool = False
    enable_powershell: bool = True
    cleanup_image: bool = True


class ForgeWimRecipe(ForgeWimRecipeCreate):
    id: str
    created_at: datetime


class ForgeWimImageCreate(BaseModel):
    name: str = "Windows 11 Pro"
    version: str = "24H2"
    architecture: str = "x64"
    path: str = r"\\192.168.1.57\deploy\images\install.wim"
    size_gb: float | None = None
    source: str = "manual"
    notes: str | None = None


class ForgeWimImage(ForgeWimImageCreate):
    id: str
    status: str = "registered"
    is_default: bool = False
    created_at: datetime


class ForgeWimBuildRequest(BaseModel):
    reference: str | None = None
    version: str | None = None
    notes: str | None = None


class ForgeWimBuildFromPathRequest(BaseModel):
    source_path: str
    reference: str | None = None
    version: str | None = None
    notes: str | None = None


class ForgeWimBuildResponse(BaseModel):
    id: str
    reference: str
    version: str
    source_image: ForgeWimImage | None = None
    source_path: str
    server_path: str
    smb_path: str
    output_wim: str
    output_smb_path: str
    manifest_path: str
    script_path: str
    status: str = "queued"
    progress: int = 0
    log_path: str = ""
    message: str


class ForgeWimBuildSummary(BaseModel):
    id: str
    reference: str
    version: str
    source_name: str
    server_path: str
    smb_path: str
    status: str = "queued"
    progress: int = 0
    log_path: str = ""
    output_smb_path: str
    manifest_path: str
    script_path: str
    created_at: str


class ForgeWimBuildListResponse(BaseModel):
    builds: list[ForgeWimBuildSummary]
    total: int
    message: str


class ForgeDriverPackCreate(BaseModel):
    name: str = "Intel RST / NVMe"
    vendor: str = "Intel"
    model_family: str = "Universal"
    category: str = "storage"
    path: str = r"\\192.168.1.57\deploy\drivers\intel-rst"
    architecture: str = "x64"
    windows_version: str = "Windows 11 24H2"
    critical: bool = True
    notes: str | None = None
    source_audit_id: str | None = None


class ForgeDriverPack(ForgeDriverPackCreate):
    id: str
    status: str = "registered"
    created_at: datetime


class ForgeUnattendProfileCreate(BaseModel):
    name: str = "Installation Windows standard"
    locale: str = "fr-FR"
    keyboard: str = "040c:0000040c"
    timezone: str = "Romance Standard Time"
    computer_name: str = "AOS-%SERIAL%"
    admin_username: str = "Admin"
    admin_password: str = "ChangeMe123!"
    organization: str = "AOS Deploy"
    product_key: str | None = None
    deployment_mode: str = "standard"
    accept_eula: bool = True
    skip_oobe: bool = True
    enable_rdp: bool = True
    auto_logon: bool = False
    create_local_account: bool = True
    include_drivers: bool = True
    run_first_logon_command: str | None = None


class ForgeUnattendProfile(ForgeUnattendProfileCreate):
    id: str
    is_default: bool = False
    created_at: datetime


class ForgeDeploymentProfileCreate(BaseModel):
    name: str = "Standard atelier"
    description: str | None = None
    image_id: str
    unattend_profile_id: str | None = None
    driver_pack_ids: list[str] = Field(default_factory=list)
    deployment_mode: str = "standard"
    enabled: bool = True


class ForgeDeploymentProfile(ForgeDeploymentProfileCreate):
    id: str
    image_name: str | None = None
    unattend_name: str | None = None
    driver_pack_names: list[str] = Field(default_factory=list)
    is_default: bool = False
    created_at: datetime


class ForgeDriverPrepareRequest(BaseModel):
    windows_version: str = "Windows 11 24H2"
    architecture: str = "x64"
    category: str = "other"
    notes: str | None = None


class ForgeDriverPrepareResponse(BaseModel):
    pack: ForgeDriverPack
    created: bool
    driver_store_path: str
    smb_path: str
    message: str


class ForgeDriverExtractResponse(BaseModel):
    pack: ForgeDriverPack
    extracted_path: str
    inf_count: int
    message: str


class ForgeMediaUploadResponse(BaseModel):
    kind: str
    filename: str
    size: int
    path: str
    smb_path: str
    image: ForgeWimImage | None = None
    message: str


class ForgeMediaStatusResponse(BaseModel):
    filename: str
    kind: str
    destination: str
    exists: bool
    size: int | None = None
    modified_at: str | None = None
    message: str


class ForgeServerMediaFile(BaseModel):
    filename: str
    kind: str
    folder: str
    server_path: str
    smb_path: str
    size: int
    size_gb: float
    modified_at: str


class ForgeServerMediaListResponse(BaseModel):
    files: list[ForgeServerMediaFile]
    total: int
    message: str


class ForgeServerMediaDeleteResponse(BaseModel):
    deleted: bool
    filename: str
    kind: str
    folder: str
    message: str


class ForgeApplianceBackup(BaseModel):
    filename: str
    path: str
    size: int
    size_mb: float
    created_at: str


class ForgeApplianceBackupResponse(BaseModel):
    backup: ForgeApplianceBackup
    included: list[str]
    message: str


class ForgeApplianceBackupListResponse(BaseModel):
    backups: list[ForgeApplianceBackup]
    total: int
    message: str


class ForgeApplianceBackupDeleteResponse(BaseModel):
    deleted: bool
    filename: str
    message: str


class ForgeApplianceRestoreRequest(BaseModel):
    dry_run: bool = True
    restore_config: bool = True
    restore_profiles: bool = True
    restore_audits: bool = False


class ForgeApplianceRestoreResponse(BaseModel):
    backup: ForgeApplianceBackup
    dry_run: bool
    restored: list[str]
    skipped: list[str]
    message: str


class ForgeUsbKitResponse(BaseModel):
    filename: str
    profile: str = "complete"
    path: str
    smb_path: str
    size: int
    size_mb: float
    included: list[str]
    message: str


class ForgeUsbKitListResponse(BaseModel):
    kits: list[ForgeUsbKitResponse]
    total: int
    message: str


class ForgeUsbKitDeleteResponse(BaseModel):
    deleted: bool
    filename: str
    message: str


class ForgeUsbKitCreateRequest(BaseModel):
    profile: str = "complete"


class ForgeRemoteActionRequest(BaseModel):
    client_id: str
    action: str
    target: str | None = None


class ForgeRemoteActionResponse(BaseModel):
    accepted: bool
    client_id: str
    action: str
    delivery: str
    message: str


class ForgeAgentHeartbeatRequest(BaseModel):
    client_id: str
    hostname: str | None = None
    ip: str | None = None
    mac: str | None = None
    serial_number: str | None = None
    brand: str | None = None
    model: str | None = None
    state: str = "live"
    boot_mode: str | None = None
    current_task: str | None = None
    progress: int | None = None
    remote_url: str | None = None
    capabilities: list[str] = Field(default_factory=list)


class ForgeAgentHeartbeatResponse(BaseModel):
    accepted: bool
    client_id: str
    message: str
