# BHARAT 3D identifier specification (v1.0)

This document specifies every identifier BHARAT 3D issues, the check character that every issued identifier carries,
and how identifiers appear in the CityJSON and LADM exports. It is normative for the code: the patterns below are the
ones in [`backend/app/realgen/norms.py`](../backend/app/realgen/norms.py), the check character is
[`backend/app/realgen/idcheck.py`](../backend/app/realgen/idcheck.py), and the tests named in section 7 check both
against this text.

> **Prototype note.** In this prototype the 14-character base ULPINs and the sanction registers are synthetic. A
> deployment would take base ULPINs from the state land records (Bhu-Aadhaar). Everything else below applies as written.

## 1. Principles

1. **One legal 3D space = one 3D ULPIN.** Each separately titled volume (flat, shop, office, basement unit, air-rights
   envelope) gets exactly one 3D ULPIN, a child of the unchanged 2D ULPIN of its parcel.
2. **Opaque and stable.** Software never derives owner, use or legal status from an identifier. The usage class
   (residential, commercial, ...) is an attribute, never part of the ID. An identifier never changes after it is
   minted. Certifying a unit "as built" changes its status, not its string.
3. **Never reused.** Partition, merger or demolition retires identifiers and mints new ones, with the old ones recorded
   as parents (lineage). A retired identifier is never issued again.
4. **Minted only when sound.** A unit with an open integrity failure, or an AI-proposed building a surveyor has not
   verified, gets no identifier (status `PENDING` or `PROPOSAL`).
5. **2D sufficiency.** A building with a single title over its whole parcel column (an unsevered house, a single
   institution) keeps its 2D ULPIN and gets no 3D ULPINs (status `NOT_REQUIRED_2D`).
6. **Common spaces are registered, not titled.** Lifts, stairs, corridors and common parking go into the Common Space
   Registry (`CSR-...`) and never get a 3D ULPIN.

## 2. Alphabet, canonical form and issued form

All identifiers use the 36 characters `0-9 A-Z` (upper case) and the hyphen `-` as a group separator.

- **Canonical form**: the identifier exactly as minted and stored in the registry (section 3 patterns). It is the
  registry key and is what the lineage records.
- **Issued form**: the canonical form, a hyphen, and one **check character** (section 4). This is the form that is
  printed, exported, copied and typed:

  ```
  MP210O46RALYNV-BL01-L00-U001      canonical
  MP210O46RALYNV-BL01-L00-U001-C    issued
  ```

Every interface accepts both forms, in upper or lower case. A typed issued form with a wrong check character is
rejected with an explanation (HTTP `422`: *"The check character of ... does not match: the identifier was probably
mistyped"*); it is never silently "corrected". No canonical identifier ends in a hyphen followed by a single
character, so the two forms can never be confused.

## 3. Identifier kinds

`ZZnn` is a zone: the two-letter state code and a two-digit local zone, e.g. `MP33` (Bhopal, Madhya Pradesh).

| Kind | Pattern (canonical) | Example (issued) |
|---|---|---|
| Base 2D ULPIN | `[0-9A-Z]{14}` | `MP210O46RALYNV-U` |
| 3D ULPIN (titled unit) | `<anchor>-BL<nn\|nnn>-<level>-<unit>` | `MP210O46RALYNV-BL01-L00-U001-C` |
| Infrastructure asset | `INF-<TUN\|FLY\|AIR\|PUB\|PRK\|MAR>-ZZnn-<nnnn>` | `INF-TUN-MP33-0001-Y` |
| Utility corridor | `INF-UTL-<GAS\|PWR\|WAT\|SEW\|TEL>-ZZnn-<nnnnnn>` | `INF-UTL-TEL-MP33-000013-O` |
| Common Space Registry | `CSR-<anchor>-BL<nn\|nnn>-C<nnn>` | `CSR-MP210O46RALYNV-BL01-C001-2` |

**3D ULPIN segments**

| Segment | Values | Meaning |
|---|---|---|
| anchor | a 14-character base ULPIN, or `INF-<PUB\|PRK\|AIR\|MAR>-ZZnn-nnnn` | The parcel (or public asset) the volume belongs to, unchanged |
| `BLnn` | `BL01` ... `BL999` | Building number on the anchor; never reassigned |
| level | `L00`-`L99` floors (`L00` = ground, including stilts), `S01`-`S99` basements counted downwards, `RF` the volume above the roof slab | Vertical position |
| unit | `Unnn` / `Unnnn` = floor × 100 + sequence on that floor (`U804` = 4th unit on floor 8); `UFLR` = a whole level under one title | Never reused |

INF classes: `TUN` tunnel bore, `FLY` flyover or viaduct, `AIR` air-rights envelope, `PUB` public asset, `PRK` public
parking, `MAR` marine lease. Utility types: `GAS`, `PWR` power, `WAT` water, `SEW` sewer, `TEL` telecom. INF sequences
are kept per class and zone in a national ledger, so the same real asset seen from two overlapping survey areas keeps
one ID.

**Exact regular expressions** (canonical form):

```
3D ULPIN : ^([0-9A-Z]{14}|INF-(PUB|PRK|AIR|MAR)-[A-Z]{2}[0-9]{2}-[0-9]{4})-BL[0-9]{2,3}-(L[0-9]{2}|S[0-9]{2}|RF)-(U[0-9]{3,4}|UFLR)$
INF      : ^INF-(TUN|FLY|AIR|PUB|PRK|MAR)-[A-Z]{2}[0-9]{2}-[0-9]{4}$
INF-UTL  : ^INF-UTL-(GAS|PWR|WAT|SEW|TEL)-[A-Z]{2}[0-9]{2}-[0-9]{6}$
CSR      : ^CSR-([0-9A-Z]{14}|INF-(PUB|PRK|AIR|MAR)-[A-Z]{2}[0-9]{2}-[0-9]{4})-BL[0-9]{2,3}-C[0-9]{3}$
ULPIN    : ^[0-9A-Z]{14}$
Issued   : <canonical>-[0-9A-Z]   with the check character of section 4
```

## 4. Check character

**Algorithm:** ISO/IEC 7064 **MOD 37-36** (hybrid system), the same check used by the GRid standard. It is computed
over the identifier's letters and digits in order; hyphens are ignored.

```
values:  '0'..'9' -> 0..9,  'A'..'Z' -> 10..35
P := 36
for each character c of the identifier, hyphens skipped:
    S := (P + value(c)) mod 36;  if S = 0 then S := 36
    P := (2 × S) mod 37
check value := (37 − P) mod 36          check character := the character with that value
```

To verify an issued identifier, compute the check character of everything before its last hyphen and compare.

**Worked example:** `MP210O46RALYNV-BL01-L00-U001`

| # | char | value | P before | S | P after |
|---|---|---|---|---|---|
| 1 | `M` | 22 | 36 | 22 | 7 |
| 2 | `P` | 25 | 7 | 32 | 27 |
| 3 | `2` | 2 | 27 | 29 | 21 |
| 4 | `1` | 1 | 21 | 22 | 7 |
| 5 | `0` | 0 | 7 | 7 | 14 |
| 6 | `O` | 24 | 14 | 2 | 4 |
| 7 | `4` | 4 | 4 | 8 | 16 |
| 8 | `6` | 6 | 16 | 22 | 7 |
| 9 | `R` | 27 | 7 | 34 | 31 |
| 10 | `A` | 10 | 31 | 5 | 10 |
| 11 | `L` | 21 | 10 | 31 | 25 |
| 12 | `Y` | 34 | 25 | 23 | 9 |
| 13 | `N` | 23 | 9 | 32 | 27 |
| 14 | `V` | 31 | 27 | 22 | 7 |
| 15 | `B` | 11 | 7 | 18 | 36 |
| 16 | `L` | 21 | 36 | 21 | 5 |
| 17 | `0` | 0 | 5 | 5 | 10 |
| 18 | `1` | 1 | 10 | 11 | 22 |
| 19 | `L` | 21 | 22 | 7 | 14 |
| 20 | `0` | 0 | 14 | 14 | 28 |
| 21 | `0` | 0 | 28 | 28 | 19 |
| 22 | `U` | 30 | 19 | 13 | 26 |
| 23 | `0` | 0 | 26 | 26 | 15 |
| 24 | `0` | 0 | 15 | 15 | 30 |
| 25 | `1` | 1 | 30 | 31 | 25 |

Final P = 25, check value = (37 − 25) mod 36 = 12 → **`C`**. Issued form: `MP210O46RALYNV-BL01-L00-U001-C`.

**Test vectors**

| Input (canonical) | Check | Issued |
|---|---|---|
| `A12425GABC1234002` (the GRid example `A1-2425G-ABC1234002-M`) | `M` | `A12425GABC1234002-M` |
| `MP210O46RALYNV` | `U` | `MP210O46RALYNV-U` |
| `MP210O46RALYNV-BL01-L00-U001` | `C` | `MP210O46RALYNV-BL01-L00-U001-C` |
| `INF-PUB-DL07-0042-BL01-L02-U201` | `C` | `INF-PUB-DL07-0042-BL01-L02-U201-C` |
| `INF-TUN-MP33-0001` | `Y` | `INF-TUN-MP33-0001-Y` |
| `INF-UTL-TEL-MP33-000013` | `O` | `INF-UTL-TEL-MP33-000013-O` |
| `CSR-MP210O46RALYNV-BL01-C001` | `2` | `CSR-MP210O46RALYNV-BL01-C001-2` |

**What it catches** (measured on the 260 real 3D ULPINs of the bundled Bhopal demo area,
[`tests/unit/test_idcheck.py`](../backend/tests/unit/test_idcheck.py)):

- every single mistyped character (236,600 of 236,600), including the common `0`/`O` and `1`/`I` mix-ups;
- all but a rare few swaps of two neighbouring different characters (5,985 of 5,988; the 3 misses are `...U101` read
  as `...U110` when the check character is `Z`).

The check character is only an error detector. It carries no meaning, and software must not use it for anything
except rejecting mistyped identifiers.

## 5. Lifecycle states

| Status | Has a minted ID | Meaning |
|---|---|---|
| `PROVISIONAL` | yes | Minted from the model; awaiting as-built certification |
| `CERTIFIED_AS_BUILT` | yes | Certified by a surveyor; the ID string is unchanged |
| `PENDING` | no | Open integrity failure (e.g. floors beyond sanction); not minted until resolved |
| `NOT_REQUIRED_2D` | no | 2D sufficiency: the parcel's 2D ULPIN is enough |
| `PROPOSAL` | no | AI-detected building awaiting surveyor verification |
| `PART_OF_INF_PUB` | no | Inside a public asset's INF-PUB volume |
| `RETIRED` | was | Partitioned or merged; children list it as a parent |
| `HISTORICAL_DEMOLISHED` | was | The volume no longer exists |
| `CANCELLED` | was | Provisional ID of an abandoned design |

Undivided land shares (UDS) are integer parts per million of the parent parcel, and sum to exactly 1,000,000 per
parcel scheme (largest-remainder rounding).

## 6. Exports

Signed-in users can download any area as open-standard files:
`GET /api/realgen/scenes/{key}/export/cityjson` and `.../export/ladm`. In the app, use the **CityJSON** and **LADM**
buttons on the 3D ULPIN registry page. Every identifier appears in both canonical and issued form.

**CityJSON 2.0** (`bharat3d-<key>.city.json`, media type `application/city+json`). It validates against the official
CityJSON 2.0.2 JSON schema (0 errors for the demo area and for a 370-building area when the export was built), and
the tests check that every solid is closed and faces outward
([`tests/api/test_exports_and_ids.py`](../backend/tests/api/test_exports_and_ids.py)). It contains **no personal
data** for any role.

| BHARAT 3D | CityJSON | Geometry | Key attributes |
|---|---|---|---|
| Building | `Building` | LOD1 `Solid`, footprint extruded from its base to its height | `ulpin` / `ulpin_issued` (parent parcel), `identity_kind`, `measuredHeight`, `storeysAboveGround`, `storeysBelowGround`, `usage_class`, `sanction_status`, `common_space_registry` (issued CSR IDs) |
| Titled unit | `BuildingUnit` (child of its `Building`) | LOD1 `Solid` between the unit's floor and ceiling | `3d_ulpin`, `3d_ulpin_issued`, `status`, `level`, `unit_code`, `usage_class`, `built_up_m2`, `carpet_m2`, `volume_m3`, `uds_ppm` |
| 2D parcel | `LandUse` | LOD1 `MultiSurface` at ground level | `ulpin`, `ulpin_issued`, `kind`, `area_m2`, `buildings`, `encumbrances` (issued INF-UTL IDs) |
| Utility corridor | `GenericCityObject` | `MultiLineString` at its depth below ground | `inf_id`, `inf_id_issued`, `kind`, `depth_m`, `buffer_m`, `operator` |

Coordinates are in the area's UTM zone (`referenceSystem`, e.g. EPSG:32643 for zone 43N). Heights are metres above
mean sea level (EGM96, from the terrain tiles). Vertices are quantised to 1 mm through `transform`.

**ISO 19152 LADM** (`bharat3d-<key>.ladm.json`): a JSON encoding of the LADM core classes.

| LADM class | Content |
|---|---|
| `LA_Level` | `L1-PARCEL` 2D parcels, `L2-UNIT` 3D titled volumes, `L3-COMMON` Common Space Registry, `L4-INF-UTL` utility corridors |
| `LA_SpatialUnit` | `suID` = issued ID, `canonicalID`, level, dimension (`2D`/`3D`), areas, volume, `zMin`/`zMax` (m above MSL), `surfaceRelation` (`above`/`below`), and geometry in EPSG:4326 |
| `LA_BAUnit` | One basic administrative unit per parcel and per titled unit (`BAU-<issued ID>`) |
| `LA_RRR` | One ownership right per titled unit, with its share as UDS ppm of the parent parcel |
| `LA_Party` | Owners, **only for views that may see owners** (surveyor, admin, municipality, see [ACCESS_POLICY.md](ACCESS_POLICY.md)). For other roles the list is empty and each right has `pID: null` with `partyWithheld` |
| `LA_RequiredRelationshipSpatialUnit` | Each 3D unit `within` its 2D parcel |

## 7. Conformance

- [`tests/unit/test_idcheck.py`](../backend/tests/unit/test_idcheck.py): GRid test vector, the examples above, a round
  trip for every identifier kind found in the demo area, all single substitutions, the neighbour-swap rate, and wrong
  check characters.
- [`tests/api/test_exports_and_ids.py`](../backend/tests/api/test_exports_and_ids.py): search, lineage and resolve
  accept the issued form and reject wrong check characters with `422`; both exports are well-formed; CityJSON solids
  are closed; no personal data reaches roles that may not see it.
- [`tests/unit/test_norms.py`](../backend/tests/unit/test_norms.py): identifier syntax, allocation, lifecycle and
  integrity.
