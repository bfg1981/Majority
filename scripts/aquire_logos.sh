#!/usr/bin/env bash

set -euo pipefail

# Require Bash 4+ for associative arrays (declare -A)
if [[ -z "${BASH_VERSINFO:-}" || "${BASH_VERSINFO[0]}" -lt 4 ]]; then
  echo "ERROR: This script requires bash 4 or newer (found: ${BASH_VERSION:-unknown})." >&2
  echo "       On macOS, install with Homebrew (brew install bash) and run with:" >&2
  echo "       /usr/local/bin/bash $0   or   /opt/homebrew/bin/bash $0" >&2
  exit 1
fi

# Declare dictionary: target_filename -> source_url
declare -A LOGOS=(
  ["no_ap_logo.svg"]="https://commons.wikimedia.org/wiki/Special:FilePath/Arbeidarpartiet.svg"
  ["no_h_logo.svg"]="https://commons.wikimedia.org/wiki/Special:FilePath/H%C3%B8gre_logo_2020.svg"
  ["no_sp_logo.png"]="https://upload.wikimedia.org/wikipedia/commons/4/4a/Senterpartiets_logo.png"
  ["no_frp_logo.svg"]="https://commons.wikimedia.org/wiki/Special:FilePath/Fremskrittspartiet_logo.svg"
  ["no_sv_logo.svg"]="https://commons.wikimedia.org/wiki/Special:FilePath/Sosialistisk_Venstreparti_logo.svg"
  ["no_r_logo.svg"]="https://commons.wikimedia.org/wiki/Special:FilePath/The_Red_party_Norway_logo.SVG"
  ["no_v_logo.svg"]="https://commons.wikimedia.org/wiki/Special:FilePath/Venstre_logo_2023.svg"
  ["no_krf_logo.svg"]="https://commons.wikimedia.org/wiki/Special:FilePath/Kristelig_Folkeparti_Logo.svg"
  ["no_mdg_logo.svg"]="https://commons.wikimedia.org/wiki/Special:FilePath/Milj%C3%B8partiet_De_Gr%C3%B8nne_Logo.svg"
  ["no_pf_logo.png"]="https://commons.wikimedia.org/wiki/Special:FilePath/Patient_Focus_logo_2021.png"
)

for target in "${!LOGOS[@]}"; do
  url="${LOGOS[$target]}"

  # Skip existing files unless FORCE=1
  if [[ -f "$target" && "${FORCE:-0}" != "1" ]]; then
    echo "Skipping $target (already exists, FORCE!=1)"
    continue
  fi

  echo "Downloading $target"
  curl -L \
    --fail \
    --retry 5 \
    --retry-delay 3 \
    "$url" \
    -o "$target"

  echo "Saved as $target"
  sleep 2
done

echo "All logos processed."
