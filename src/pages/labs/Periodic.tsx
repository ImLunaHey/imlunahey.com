import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';

// ─── element data ──────────────────────────────────────────────────────────
// Compact table of the 118 known elements. Columns: number, symbol, name,
// atomic mass (u), category, period, group (0 if lanthanide/actinide row),
// phase at STP, electron configuration (noble-gas-abbreviated), year discovered.

type Category =
  | 'alkali' | 'alkaline' | 'transition' | 'post-transition' | 'metalloid'
  | 'nonmetal' | 'halogen' | 'noble' | 'lanthanide' | 'actinide' | 'unknown';

type Element = {
  n: number; sym: string; name: string; mass: number;
  cat: Category; period: number; group: number;
  phase: 'solid' | 'liquid' | 'gas' | 'synthetic';
  config: string;
  year?: number;
};

const ELEMENTS: Element[] = [
  { n: 1, sym: 'H',  name: 'Hydrogen',     mass: 1.008,  cat: 'nonmetal',  period: 1, group: 1,  phase: 'gas',    config: '1s1',         year: 1766 },
  { n: 2, sym: 'He', name: 'Helium',       mass: 4.003,  cat: 'noble',     period: 1, group: 18, phase: 'gas',    config: '1s2',         year: 1868 },
  { n: 3, sym: 'Li', name: 'Lithium',      mass: 6.94,   cat: 'alkali',    period: 2, group: 1,  phase: 'solid',  config: '[He] 2s1',    year: 1817 },
  { n: 4, sym: 'Be', name: 'Beryllium',    mass: 9.012,  cat: 'alkaline',  period: 2, group: 2,  phase: 'solid',  config: '[He] 2s2',    year: 1798 },
  { n: 5, sym: 'B',  name: 'Boron',        mass: 10.81,  cat: 'metalloid', period: 2, group: 13, phase: 'solid',  config: '[He] 2s2 2p1',year: 1808 },
  { n: 6, sym: 'C',  name: 'Carbon',       mass: 12.011, cat: 'nonmetal',  period: 2, group: 14, phase: 'solid',  config: '[He] 2s2 2p2' },
  { n: 7, sym: 'N',  name: 'Nitrogen',     mass: 14.007, cat: 'nonmetal',  period: 2, group: 15, phase: 'gas',    config: '[He] 2s2 2p3',year: 1772 },
  { n: 8, sym: 'O',  name: 'Oxygen',       mass: 15.999, cat: 'nonmetal',  period: 2, group: 16, phase: 'gas',    config: '[He] 2s2 2p4',year: 1774 },
  { n: 9, sym: 'F',  name: 'Fluorine',     mass: 18.998, cat: 'halogen',   period: 2, group: 17, phase: 'gas',    config: '[He] 2s2 2p5',year: 1886 },
  { n: 10, sym: 'Ne', name: 'Neon',         mass: 20.180, cat: 'noble',     period: 2, group: 18, phase: 'gas',    config: '[He] 2s2 2p6',year: 1898 },
  { n: 11, sym: 'Na', name: 'Sodium',       mass: 22.990, cat: 'alkali',    period: 3, group: 1,  phase: 'solid',  config: '[Ne] 3s1',    year: 1807 },
  { n: 12, sym: 'Mg', name: 'Magnesium',    mass: 24.305, cat: 'alkaline',  period: 3, group: 2,  phase: 'solid',  config: '[Ne] 3s2',    year: 1755 },
  { n: 13, sym: 'Al', name: 'Aluminium',    mass: 26.982, cat: 'post-transition', period: 3, group: 13, phase: 'solid', config: '[Ne] 3s2 3p1', year: 1825 },
  { n: 14, sym: 'Si', name: 'Silicon',      mass: 28.085, cat: 'metalloid', period: 3, group: 14, phase: 'solid',  config: '[Ne] 3s2 3p2',year: 1824 },
  { n: 15, sym: 'P',  name: 'Phosphorus',   mass: 30.974, cat: 'nonmetal',  period: 3, group: 15, phase: 'solid',  config: '[Ne] 3s2 3p3',year: 1669 },
  { n: 16, sym: 'S',  name: 'Sulfur',       mass: 32.06,  cat: 'nonmetal',  period: 3, group: 16, phase: 'solid',  config: '[Ne] 3s2 3p4' },
  { n: 17, sym: 'Cl', name: 'Chlorine',     mass: 35.45,  cat: 'halogen',   period: 3, group: 17, phase: 'gas',    config: '[Ne] 3s2 3p5',year: 1774 },
  { n: 18, sym: 'Ar', name: 'Argon',        mass: 39.948, cat: 'noble',     period: 3, group: 18, phase: 'gas',    config: '[Ne] 3s2 3p6',year: 1894 },
  { n: 19, sym: 'K',  name: 'Potassium',    mass: 39.098, cat: 'alkali',    period: 4, group: 1,  phase: 'solid',  config: '[Ar] 4s1',    year: 1807 },
  { n: 20, sym: 'Ca', name: 'Calcium',      mass: 40.078, cat: 'alkaline',  period: 4, group: 2,  phase: 'solid',  config: '[Ar] 4s2',    year: 1808 },
  { n: 21, sym: 'Sc', name: 'Scandium',     mass: 44.956, cat: 'transition', period: 4, group: 3,  phase: 'solid', config: '[Ar] 3d1 4s2', year: 1879 },
  { n: 22, sym: 'Ti', name: 'Titanium',     mass: 47.867, cat: 'transition', period: 4, group: 4,  phase: 'solid', config: '[Ar] 3d2 4s2', year: 1791 },
  { n: 23, sym: 'V',  name: 'Vanadium',     mass: 50.942, cat: 'transition', period: 4, group: 5,  phase: 'solid', config: '[Ar] 3d3 4s2', year: 1801 },
  { n: 24, sym: 'Cr', name: 'Chromium',     mass: 51.996, cat: 'transition', period: 4, group: 6,  phase: 'solid', config: '[Ar] 3d5 4s1', year: 1797 },
  { n: 25, sym: 'Mn', name: 'Manganese',    mass: 54.938, cat: 'transition', period: 4, group: 7,  phase: 'solid', config: '[Ar] 3d5 4s2', year: 1774 },
  { n: 26, sym: 'Fe', name: 'Iron',         mass: 55.845, cat: 'transition', period: 4, group: 8,  phase: 'solid', config: '[Ar] 3d6 4s2' },
  { n: 27, sym: 'Co', name: 'Cobalt',       mass: 58.933, cat: 'transition', period: 4, group: 9,  phase: 'solid', config: '[Ar] 3d7 4s2', year: 1735 },
  { n: 28, sym: 'Ni', name: 'Nickel',       mass: 58.693, cat: 'transition', period: 4, group: 10, phase: 'solid', config: '[Ar] 3d8 4s2', year: 1751 },
  { n: 29, sym: 'Cu', name: 'Copper',       mass: 63.546, cat: 'transition', period: 4, group: 11, phase: 'solid', config: '[Ar] 3d10 4s1' },
  { n: 30, sym: 'Zn', name: 'Zinc',         mass: 65.38,  cat: 'transition', period: 4, group: 12, phase: 'solid', config: '[Ar] 3d10 4s2' },
  { n: 31, sym: 'Ga', name: 'Gallium',      mass: 69.723, cat: 'post-transition', period: 4, group: 13, phase: 'solid', config: '[Ar] 3d10 4s2 4p1', year: 1875 },
  { n: 32, sym: 'Ge', name: 'Germanium',    mass: 72.63,  cat: 'metalloid',  period: 4, group: 14, phase: 'solid', config: '[Ar] 3d10 4s2 4p2', year: 1886 },
  { n: 33, sym: 'As', name: 'Arsenic',      mass: 74.922, cat: 'metalloid',  period: 4, group: 15, phase: 'solid', config: '[Ar] 3d10 4s2 4p3' },
  { n: 34, sym: 'Se', name: 'Selenium',     mass: 78.971, cat: 'nonmetal',  period: 4, group: 16, phase: 'solid', config: '[Ar] 3d10 4s2 4p4', year: 1817 },
  { n: 35, sym: 'Br', name: 'Bromine',      mass: 79.904, cat: 'halogen',   period: 4, group: 17, phase: 'liquid', config: '[Ar] 3d10 4s2 4p5', year: 1826 },
  { n: 36, sym: 'Kr', name: 'Krypton',      mass: 83.798, cat: 'noble',     period: 4, group: 18, phase: 'gas',   config: '[Ar] 3d10 4s2 4p6', year: 1898 },
  { n: 37, sym: 'Rb', name: 'Rubidium',     mass: 85.468, cat: 'alkali',    period: 5, group: 1,  phase: 'solid', config: '[Kr] 5s1', year: 1861 },
  { n: 38, sym: 'Sr', name: 'Strontium',    mass: 87.62,  cat: 'alkaline',  period: 5, group: 2,  phase: 'solid', config: '[Kr] 5s2', year: 1790 },
  { n: 39, sym: 'Y',  name: 'Yttrium',      mass: 88.906, cat: 'transition', period: 5, group: 3,  phase: 'solid', config: '[Kr] 4d1 5s2', year: 1794 },
  { n: 40, sym: 'Zr', name: 'Zirconium',    mass: 91.224, cat: 'transition', period: 5, group: 4,  phase: 'solid', config: '[Kr] 4d2 5s2', year: 1789 },
  { n: 41, sym: 'Nb', name: 'Niobium',      mass: 92.906, cat: 'transition', period: 5, group: 5,  phase: 'solid', config: '[Kr] 4d4 5s1', year: 1801 },
  { n: 42, sym: 'Mo', name: 'Molybdenum',   mass: 95.95,  cat: 'transition', period: 5, group: 6,  phase: 'solid', config: '[Kr] 4d5 5s1', year: 1778 },
  { n: 43, sym: 'Tc', name: 'Technetium',   mass: 98,     cat: 'transition', period: 5, group: 7,  phase: 'solid', config: '[Kr] 4d5 5s2', year: 1937 },
  { n: 44, sym: 'Ru', name: 'Ruthenium',    mass: 101.07, cat: 'transition', period: 5, group: 8,  phase: 'solid', config: '[Kr] 4d7 5s1', year: 1844 },
  { n: 45, sym: 'Rh', name: 'Rhodium',      mass: 102.91, cat: 'transition', period: 5, group: 9,  phase: 'solid', config: '[Kr] 4d8 5s1', year: 1803 },
  { n: 46, sym: 'Pd', name: 'Palladium',    mass: 106.42, cat: 'transition', period: 5, group: 10, phase: 'solid', config: '[Kr] 4d10', year: 1803 },
  { n: 47, sym: 'Ag', name: 'Silver',       mass: 107.87, cat: 'transition', period: 5, group: 11, phase: 'solid', config: '[Kr] 4d10 5s1' },
  { n: 48, sym: 'Cd', name: 'Cadmium',      mass: 112.41, cat: 'transition', period: 5, group: 12, phase: 'solid', config: '[Kr] 4d10 5s2', year: 1817 },
  { n: 49, sym: 'In', name: 'Indium',       mass: 114.82, cat: 'post-transition', period: 5, group: 13, phase: 'solid', config: '[Kr] 4d10 5s2 5p1', year: 1863 },
  { n: 50, sym: 'Sn', name: 'Tin',          mass: 118.71, cat: 'post-transition', period: 5, group: 14, phase: 'solid', config: '[Kr] 4d10 5s2 5p2' },
  { n: 51, sym: 'Sb', name: 'Antimony',     mass: 121.76, cat: 'metalloid', period: 5, group: 15, phase: 'solid', config: '[Kr] 4d10 5s2 5p3' },
  { n: 52, sym: 'Te', name: 'Tellurium',    mass: 127.60, cat: 'metalloid', period: 5, group: 16, phase: 'solid', config: '[Kr] 4d10 5s2 5p4', year: 1782 },
  { n: 53, sym: 'I',  name: 'Iodine',       mass: 126.90, cat: 'halogen',   period: 5, group: 17, phase: 'solid', config: '[Kr] 4d10 5s2 5p5', year: 1811 },
  { n: 54, sym: 'Xe', name: 'Xenon',        mass: 131.29, cat: 'noble',     period: 5, group: 18, phase: 'gas',   config: '[Kr] 4d10 5s2 5p6', year: 1898 },
  { n: 55, sym: 'Cs', name: 'Caesium',      mass: 132.91, cat: 'alkali',    period: 6, group: 1,  phase: 'solid', config: '[Xe] 6s1', year: 1860 },
  { n: 56, sym: 'Ba', name: 'Barium',       mass: 137.33, cat: 'alkaline',  period: 6, group: 2,  phase: 'solid', config: '[Xe] 6s2', year: 1808 },
  { n: 57, sym: 'La', name: 'Lanthanum',    mass: 138.91, cat: 'lanthanide', period: 6, group: 0, phase: 'solid', config: '[Xe] 5d1 6s2', year: 1839 },
  { n: 58, sym: 'Ce', name: 'Cerium',       mass: 140.12, cat: 'lanthanide', period: 6, group: 0, phase: 'solid', config: '[Xe] 4f1 5d1 6s2', year: 1803 },
  { n: 59, sym: 'Pr', name: 'Praseodymium', mass: 140.91, cat: 'lanthanide', period: 6, group: 0, phase: 'solid', config: '[Xe] 4f3 6s2', year: 1885 },
  { n: 60, sym: 'Nd', name: 'Neodymium',    mass: 144.24, cat: 'lanthanide', period: 6, group: 0, phase: 'solid', config: '[Xe] 4f4 6s2', year: 1885 },
  { n: 61, sym: 'Pm', name: 'Promethium',   mass: 145,    cat: 'lanthanide', period: 6, group: 0, phase: 'synthetic', config: '[Xe] 4f5 6s2', year: 1945 },
  { n: 62, sym: 'Sm', name: 'Samarium',     mass: 150.36, cat: 'lanthanide', period: 6, group: 0, phase: 'solid', config: '[Xe] 4f6 6s2', year: 1879 },
  { n: 63, sym: 'Eu', name: 'Europium',     mass: 151.96, cat: 'lanthanide', period: 6, group: 0, phase: 'solid', config: '[Xe] 4f7 6s2', year: 1901 },
  { n: 64, sym: 'Gd', name: 'Gadolinium',   mass: 157.25, cat: 'lanthanide', period: 6, group: 0, phase: 'solid', config: '[Xe] 4f7 5d1 6s2', year: 1880 },
  { n: 65, sym: 'Tb', name: 'Terbium',      mass: 158.93, cat: 'lanthanide', period: 6, group: 0, phase: 'solid', config: '[Xe] 4f9 6s2', year: 1843 },
  { n: 66, sym: 'Dy', name: 'Dysprosium',   mass: 162.50, cat: 'lanthanide', period: 6, group: 0, phase: 'solid', config: '[Xe] 4f10 6s2', year: 1886 },
  { n: 67, sym: 'Ho', name: 'Holmium',      mass: 164.93, cat: 'lanthanide', period: 6, group: 0, phase: 'solid', config: '[Xe] 4f11 6s2', year: 1878 },
  { n: 68, sym: 'Er', name: 'Erbium',       mass: 167.26, cat: 'lanthanide', period: 6, group: 0, phase: 'solid', config: '[Xe] 4f12 6s2', year: 1842 },
  { n: 69, sym: 'Tm', name: 'Thulium',      mass: 168.93, cat: 'lanthanide', period: 6, group: 0, phase: 'solid', config: '[Xe] 4f13 6s2', year: 1879 },
  { n: 70, sym: 'Yb', name: 'Ytterbium',    mass: 173.05, cat: 'lanthanide', period: 6, group: 0, phase: 'solid', config: '[Xe] 4f14 6s2', year: 1878 },
  { n: 71, sym: 'Lu', name: 'Lutetium',     mass: 174.97, cat: 'lanthanide', period: 6, group: 0, phase: 'solid', config: '[Xe] 4f14 5d1 6s2', year: 1907 },
  { n: 72, sym: 'Hf', name: 'Hafnium',      mass: 178.49, cat: 'transition', period: 6, group: 4,  phase: 'solid', config: '[Xe] 4f14 5d2 6s2', year: 1923 },
  { n: 73, sym: 'Ta', name: 'Tantalum',     mass: 180.95, cat: 'transition', period: 6, group: 5,  phase: 'solid', config: '[Xe] 4f14 5d3 6s2', year: 1802 },
  { n: 74, sym: 'W',  name: 'Tungsten',     mass: 183.84, cat: 'transition', period: 6, group: 6,  phase: 'solid', config: '[Xe] 4f14 5d4 6s2', year: 1783 },
  { n: 75, sym: 'Re', name: 'Rhenium',      mass: 186.21, cat: 'transition', period: 6, group: 7,  phase: 'solid', config: '[Xe] 4f14 5d5 6s2', year: 1925 },
  { n: 76, sym: 'Os', name: 'Osmium',       mass: 190.23, cat: 'transition', period: 6, group: 8,  phase: 'solid', config: '[Xe] 4f14 5d6 6s2', year: 1803 },
  { n: 77, sym: 'Ir', name: 'Iridium',      mass: 192.22, cat: 'transition', period: 6, group: 9,  phase: 'solid', config: '[Xe] 4f14 5d7 6s2', year: 1803 },
  { n: 78, sym: 'Pt', name: 'Platinum',     mass: 195.08, cat: 'transition', period: 6, group: 10, phase: 'solid', config: '[Xe] 4f14 5d9 6s1', year: 1735 },
  { n: 79, sym: 'Au', name: 'Gold',         mass: 196.97, cat: 'transition', period: 6, group: 11, phase: 'solid', config: '[Xe] 4f14 5d10 6s1' },
  { n: 80, sym: 'Hg', name: 'Mercury',      mass: 200.59, cat: 'transition', period: 6, group: 12, phase: 'liquid', config: '[Xe] 4f14 5d10 6s2' },
  { n: 81, sym: 'Tl', name: 'Thallium',     mass: 204.38, cat: 'post-transition', period: 6, group: 13, phase: 'solid', config: '[Xe] 4f14 5d10 6s2 6p1', year: 1861 },
  { n: 82, sym: 'Pb', name: 'Lead',         mass: 207.2,  cat: 'post-transition', period: 6, group: 14, phase: 'solid', config: '[Xe] 4f14 5d10 6s2 6p2' },
  { n: 83, sym: 'Bi', name: 'Bismuth',      mass: 208.98, cat: 'post-transition', period: 6, group: 15, phase: 'solid', config: '[Xe] 4f14 5d10 6s2 6p3' },
  { n: 84, sym: 'Po', name: 'Polonium',     mass: 209,    cat: 'post-transition', period: 6, group: 16, phase: 'solid', config: '[Xe] 4f14 5d10 6s2 6p4', year: 1898 },
  { n: 85, sym: 'At', name: 'Astatine',     mass: 210,    cat: 'halogen',    period: 6, group: 17, phase: 'solid', config: '[Xe] 4f14 5d10 6s2 6p5', year: 1940 },
  { n: 86, sym: 'Rn', name: 'Radon',        mass: 222,    cat: 'noble',      period: 6, group: 18, phase: 'gas',   config: '[Xe] 4f14 5d10 6s2 6p6', year: 1900 },
  { n: 87, sym: 'Fr', name: 'Francium',     mass: 223,    cat: 'alkali',     period: 7, group: 1,  phase: 'solid', config: '[Rn] 7s1', year: 1939 },
  { n: 88, sym: 'Ra', name: 'Radium',       mass: 226,    cat: 'alkaline',   period: 7, group: 2,  phase: 'solid', config: '[Rn] 7s2', year: 1898 },
  { n: 89, sym: 'Ac', name: 'Actinium',     mass: 227,    cat: 'actinide',   period: 7, group: 0,  phase: 'solid', config: '[Rn] 6d1 7s2', year: 1899 },
  { n: 90, sym: 'Th', name: 'Thorium',      mass: 232.04, cat: 'actinide',   period: 7, group: 0,  phase: 'solid', config: '[Rn] 6d2 7s2', year: 1828 },
  { n: 91, sym: 'Pa', name: 'Protactinium', mass: 231.04, cat: 'actinide',   period: 7, group: 0,  phase: 'solid', config: '[Rn] 5f2 6d1 7s2', year: 1913 },
  { n: 92, sym: 'U',  name: 'Uranium',      mass: 238.03, cat: 'actinide',   period: 7, group: 0,  phase: 'solid', config: '[Rn] 5f3 6d1 7s2', year: 1789 },
  { n: 93, sym: 'Np', name: 'Neptunium',    mass: 237,    cat: 'actinide',   period: 7, group: 0,  phase: 'solid', config: '[Rn] 5f4 6d1 7s2', year: 1940 },
  { n: 94, sym: 'Pu', name: 'Plutonium',    mass: 244,    cat: 'actinide',   period: 7, group: 0,  phase: 'solid', config: '[Rn] 5f6 7s2', year: 1940 },
  { n: 95, sym: 'Am', name: 'Americium',    mass: 243,    cat: 'actinide',   period: 7, group: 0,  phase: 'solid', config: '[Rn] 5f7 7s2', year: 1944 },
  { n: 96, sym: 'Cm', name: 'Curium',       mass: 247,    cat: 'actinide',   period: 7, group: 0,  phase: 'solid', config: '[Rn] 5f7 6d1 7s2', year: 1944 },
  { n: 97, sym: 'Bk', name: 'Berkelium',    mass: 247,    cat: 'actinide',   period: 7, group: 0,  phase: 'solid', config: '[Rn] 5f9 7s2', year: 1949 },
  { n: 98, sym: 'Cf', name: 'Californium',  mass: 251,    cat: 'actinide',   period: 7, group: 0,  phase: 'solid', config: '[Rn] 5f10 7s2', year: 1950 },
  { n: 99, sym: 'Es', name: 'Einsteinium',  mass: 252,    cat: 'actinide',   period: 7, group: 0,  phase: 'solid', config: '[Rn] 5f11 7s2', year: 1952 },
  { n: 100, sym: 'Fm', name: 'Fermium',     mass: 257,    cat: 'actinide',   period: 7, group: 0,  phase: 'synthetic', config: '[Rn] 5f12 7s2', year: 1952 },
  { n: 101, sym: 'Md', name: 'Mendelevium', mass: 258,    cat: 'actinide',   period: 7, group: 0,  phase: 'synthetic', config: '[Rn] 5f13 7s2', year: 1955 },
  { n: 102, sym: 'No', name: 'Nobelium',    mass: 259,    cat: 'actinide',   period: 7, group: 0,  phase: 'synthetic', config: '[Rn] 5f14 7s2', year: 1966 },
  { n: 103, sym: 'Lr', name: 'Lawrencium',  mass: 266,    cat: 'actinide',   period: 7, group: 0,  phase: 'synthetic', config: '[Rn] 5f14 7s2 7p1', year: 1961 },
  { n: 104, sym: 'Rf', name: 'Rutherfordium', mass: 267, cat: 'transition', period: 7, group: 4,  phase: 'synthetic', config: '[Rn] 5f14 6d2 7s2', year: 1964 },
  { n: 105, sym: 'Db', name: 'Dubnium',     mass: 268,    cat: 'transition', period: 7, group: 5,  phase: 'synthetic', config: '[Rn] 5f14 6d3 7s2', year: 1968 },
  { n: 106, sym: 'Sg', name: 'Seaborgium',  mass: 269,    cat: 'transition', period: 7, group: 6,  phase: 'synthetic', config: '[Rn] 5f14 6d4 7s2', year: 1974 },
  { n: 107, sym: 'Bh', name: 'Bohrium',     mass: 270,    cat: 'transition', period: 7, group: 7,  phase: 'synthetic', config: '[Rn] 5f14 6d5 7s2', year: 1981 },
  { n: 108, sym: 'Hs', name: 'Hassium',     mass: 269,    cat: 'transition', period: 7, group: 8,  phase: 'synthetic', config: '[Rn] 5f14 6d6 7s2', year: 1984 },
  { n: 109, sym: 'Mt', name: 'Meitnerium',  mass: 278,    cat: 'unknown',    period: 7, group: 9,  phase: 'synthetic', config: '[Rn] 5f14 6d7 7s2', year: 1982 },
  { n: 110, sym: 'Ds', name: 'Darmstadtium', mass: 281,   cat: 'unknown',    period: 7, group: 10, phase: 'synthetic', config: '[Rn] 5f14 6d9 7s1', year: 1994 },
  { n: 111, sym: 'Rg', name: 'Roentgenium', mass: 282,    cat: 'unknown',    period: 7, group: 11, phase: 'synthetic', config: '[Rn] 5f14 6d10 7s1', year: 1994 },
  { n: 112, sym: 'Cn', name: 'Copernicium', mass: 285,    cat: 'transition', period: 7, group: 12, phase: 'synthetic', config: '[Rn] 5f14 6d10 7s2', year: 1996 },
  { n: 113, sym: 'Nh', name: 'Nihonium',    mass: 286,    cat: 'unknown',    period: 7, group: 13, phase: 'synthetic', config: '[Rn] 5f14 6d10 7s2 7p1', year: 2003 },
  { n: 114, sym: 'Fl', name: 'Flerovium',   mass: 289,    cat: 'unknown',    period: 7, group: 14, phase: 'synthetic', config: '[Rn] 5f14 6d10 7s2 7p2', year: 1999 },
  { n: 115, sym: 'Mc', name: 'Moscovium',   mass: 290,    cat: 'unknown',    period: 7, group: 15, phase: 'synthetic', config: '[Rn] 5f14 6d10 7s2 7p3', year: 2003 },
  { n: 116, sym: 'Lv', name: 'Livermorium', mass: 293,    cat: 'unknown',    period: 7, group: 16, phase: 'synthetic', config: '[Rn] 5f14 6d10 7s2 7p4', year: 2000 },
  { n: 117, sym: 'Ts', name: 'Tennessine',  mass: 294,    cat: 'unknown',    period: 7, group: 17, phase: 'synthetic', config: '[Rn] 5f14 6d10 7s2 7p5', year: 2010 },
  { n: 118, sym: 'Og', name: 'Oganesson',   mass: 294,    cat: 'unknown',    period: 7, group: 18, phase: 'synthetic', config: '[Rn] 5f14 6d10 7s2 7p6', year: 2002 },
];

const CAT_COLORS: Record<Category, string> = {
  'alkali':           '#ff7e79',
  'alkaline':         '#ffa85a',
  'transition':       '#ffd36a',
  'post-transition':  '#a7d96a',
  'metalloid':        '#6ad99a',
  'nonmetal':         '#6ae0d6',
  'halogen':          '#6aa0e0',
  'noble':            '#b78ae0',
  'lanthanide':       '#e06ac2',
  'actinide':         '#e06a7e',
  'unknown':          '#555',
};

const CAT_LABELS: Record<Category, string> = {
  'alkali':           'alkali metal',
  'alkaline':         'alkaline earth',
  'transition':       'transition metal',
  'post-transition':  'post-transition',
  'metalloid':        'metalloid',
  'nonmetal':         'nonmetal',
  'halogen':          'halogen',
  'noble':            'noble gas',
  'lanthanide':       'lanthanide',
  'actinide':         'actinide',
  'unknown':          'unknown',
};

// Layout: main grid is period × group. Lanthanides/actinides sit in rows 9+10.
function gridPosition(el: Element): { row: number; col: number } | null {
  if (el.cat === 'lanthanide') return { row: 9, col: el.n - 57 + 3 };
  if (el.cat === 'actinide') return { row: 10, col: el.n - 89 + 3 };
  if (el.n === 1) return { row: 1, col: 1 };
  if (el.n === 2) return { row: 1, col: 18 };
  return { row: el.period, col: el.group };
}

export default function PeriodicPage() {
  const [selected, setSelected] = useState<Element | null>(ELEMENTS[0]);
  const [activeCat, setActiveCat] = useState<Category | 'all'>('all');
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const matches = useMemo(() => {
    if (!q) return new Set<number>();
    const s = new Set<number>();
    for (const e of ELEMENTS) {
      if (e.sym.toLowerCase() === q || e.name.toLowerCase().includes(q) || String(e.n) === q) s.add(e.n);
    }
    return s;
  }, [q]);

  const isDim = (e: Element): boolean => {
    if (activeCat !== 'all' && e.cat !== activeCat) return true;
    if (q && !matches.has(e.n)) return true;
    return false;
  };

  const categories: Category[] = ['alkali','alkaline','transition','post-transition','metalloid','nonmetal','halogen','noble','lanthanide','actinide','unknown'];

  return (
    <>
      <style>{CSS}</style>
      <main className="shell-periodic">
        <header className="page-hd">
          <div className="label">~/labs/periodic</div>
          <h1>periodic<span className="dot">.</span></h1>
          <p className="sub">
            every known element, from hydrogen to oganesson. hover any cell for the glance panel;
            click to pin it. filter by category or search by symbol / name / atomic number.
          </p>
        </header>

        <section className="filters">
          <input
            className="search"
            placeholder="search · he, iron, 79, au…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="cat-chips">
            <button className={`chip ${activeCat === 'all' ? 'on' : ''}`} onClick={() => setActiveCat('all')}>
              all
            </button>
            {categories.map((c) => (
              <button
                key={c}
                className={`chip ${activeCat === c ? 'on' : ''}`}
                style={{ '--chip-accent': CAT_COLORS[c] } as React.CSSProperties}
                onClick={() => setActiveCat(c)}
              >
                <span className="chip-dot" />
                {CAT_LABELS[c]}
              </button>
            ))}
          </div>
        </section>

        <section className="table">
          {ELEMENTS.map((el) => {
            const pos = gridPosition(el);
            if (!pos) return null;
            return (
              <button
                key={el.n}
                className={`el ${selected?.n === el.n ? 'sel' : ''} ${isDim(el) ? 'dim' : ''}`}
                style={{
                  gridRow: pos.row,
                  gridColumn: pos.col,
                  '--el-accent': CAT_COLORS[el.cat],
                } as React.CSSProperties}
                onClick={() => setSelected(el)}
                onMouseEnter={() => setSelected(el)}
              >
                <span className="n">{el.n}</span>
                <span className="sym">{el.sym}</span>
                <span className="mass">{el.mass < 100 ? el.mass.toFixed(2) : Math.round(el.mass)}</span>
              </button>
            );
          })}
          <div className="gap" style={{ gridRow: 6, gridColumn: 3 }}>*</div>
          <div className="gap" style={{ gridRow: 7, gridColumn: 3 }}>**</div>
        </section>

        {selected ? (
          <section className="detail">
            <div className="detail-hd" style={{ '--el-accent': CAT_COLORS[selected.cat] } as React.CSSProperties}>
              <div className="big-sym">{selected.sym}</div>
              <div>
                <div className="d-name">{selected.name}</div>
                <div className="d-cat">{CAT_LABELS[selected.cat]}</div>
              </div>
              <div className="d-num">{selected.n}</div>
            </div>
            <div className="detail-grid">
              <div><span className="dk">atomic mass</span><b>{selected.mass} u</b></div>
              <div><span className="dk">period</span><b>{selected.period}</b></div>
              <div><span className="dk">group</span><b>{selected.group || '—'}</b></div>
              <div><span className="dk">phase @ stp</span><b>{selected.phase}</b></div>
              <div className="wide"><span className="dk">electron configuration</span><b>{selected.config}</b></div>
              <div><span className="dk">discovered</span><b>{selected.year ?? '—'}</b></div>
            </div>
          </section>
        ) : null}

        <footer className="labs-footer">
          <span>118 elements · <span className="t-accent">hydrogen → oganesson</span></span>
          <Link to="/labs" className="t-accent">← labs</Link>
        </footer>
      </main>
    </>
  );
}

const CSS = `
  .shell-periodic { max-width: 1400px; margin: 0 auto; padding: 0 var(--sp-6); }
  .page-hd { padding: 64px 0 var(--sp-4); border-bottom: 1px solid var(--color-border); }
  .page-hd .label { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-bottom: 8px; }
  .page-hd h1 { font-family: var(--font-display); font-size: clamp(56px, 9vw, 128px); font-weight: 500; letter-spacing: -0.03em; color: var(--color-fg); line-height: 0.9; }
  .page-hd .dot { color: var(--color-accent); text-shadow: 0 0 16px var(--accent-glow); }
  .page-hd .sub { color: var(--color-fg-dim); font-size: var(--fs-md); max-width: 62ch; margin-top: var(--sp-3); }

  .filters { margin-top: var(--sp-4); display: flex; flex-direction: column; gap: var(--sp-3); }
  .search { width: 100%; max-width: 320px; background: var(--color-bg-panel); border: 1px solid var(--color-border); color: var(--color-fg); padding: 8px var(--sp-3); font-family: var(--font-mono); font-size: var(--fs-sm); outline: 0; }
  .search:focus { border-color: var(--color-accent-dim); }
  .cat-chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .chip {
    display: inline-flex; align-items: center; gap: 6px;
    background: transparent; border: 1px solid var(--color-border);
    color: var(--color-fg-dim); padding: 3px 9px;
    font-family: var(--font-mono); font-size: var(--fs-xs);
    cursor: pointer; text-transform: lowercase;
  }
  .chip:hover { border-color: var(--color-accent-dim); color: var(--color-fg); }
  .chip.on { color: var(--color-fg); border-color: var(--chip-accent, var(--color-accent-dim)); background: color-mix(in oklch, var(--chip-accent, var(--color-accent)) 6%, transparent); }
  .chip-dot { display: inline-block; width: 8px; height: 8px; background: var(--chip-accent); border-radius: 50%; }

  .table {
    margin-top: var(--sp-5);
    display: grid;
    grid-template-columns: repeat(18, minmax(0, 1fr));
    grid-template-rows: repeat(10, 1fr);
    gap: 3px;
    aspect-ratio: 18 / 10;
  }
  .el {
    background: var(--color-bg-panel);
    border: 1px solid color-mix(in oklch, var(--el-accent) 40%, var(--color-border));
    color: var(--color-fg);
    display: grid;
    grid-template-rows: auto 1fr auto;
    gap: 1px;
    padding: 4px;
    font-family: var(--font-mono);
    cursor: pointer;
    min-width: 0;
    overflow: hidden;
    position: relative;
    transition: transform .12s, border-color .12s, background .12s;
  }
  .el::before {
    content: '';
    position: absolute; inset: 0;
    background: color-mix(in oklch, var(--el-accent) 10%, transparent);
    pointer-events: none;
  }
  .el:hover { transform: translateY(-1px); border-color: var(--el-accent); }
  .el:hover::before { background: color-mix(in oklch, var(--el-accent) 18%, transparent); }
  .el.sel { border-color: var(--el-accent); box-shadow: 0 0 0 1px var(--el-accent), 0 0 14px color-mix(in oklch, var(--el-accent) 50%, transparent); }
  .el.dim { opacity: 0.18; }
  .el .n { font-size: 10px; color: var(--color-fg-dim); z-index: 1; }
  .el .sym { font-family: var(--font-display); font-size: clamp(12px, 2vw, 24px); color: var(--el-accent); text-align: center; align-self: center; z-index: 1; line-height: 1; }
  .el .mass { font-size: 9px; color: var(--color-fg-faint); text-align: center; z-index: 1; }
  .gap { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); display: flex; align-items: center; justify-content: center; }

  .detail { margin-top: var(--sp-5); border: 1px solid var(--color-border); background: var(--color-bg-panel); }
  .detail-hd {
    display: grid;
    grid-template-columns: 80px 1fr auto;
    gap: var(--sp-4);
    align-items: center;
    padding: var(--sp-4);
    border-bottom: 1px solid var(--color-border);
    background: color-mix(in oklch, var(--el-accent) 8%, transparent);
  }
  .big-sym { font-family: var(--font-display); font-size: 64px; color: var(--el-accent); line-height: 1; text-align: center; }
  .d-name { font-family: var(--font-display); font-size: 28px; color: var(--color-fg); letter-spacing: -0.02em; line-height: 1; }
  .d-cat { color: var(--color-fg-faint); font-family: var(--font-mono); font-size: var(--fs-xs); margin-top: 4px; text-transform: uppercase; letter-spacing: 0.08em; }
  .d-num { font-family: var(--font-mono); font-size: var(--fs-xl); color: var(--el-accent); }

  .detail-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--sp-3); padding: var(--sp-4); }
  .detail-grid .wide { grid-column: 1 / -1; }
  .detail-grid > div { display: flex; flex-direction: column; gap: 3px; font-family: var(--font-mono); font-size: var(--fs-xs); }
  .dk { color: var(--color-fg-faint); text-transform: uppercase; letter-spacing: 0.08em; }
  .detail-grid b { color: var(--color-fg); font-size: var(--fs-sm); font-weight: 400; }

  .labs-footer { display: flex; justify-content: space-between; padding: var(--sp-8) 0 var(--sp-10); margin-top: var(--sp-10); border-top: 1px solid var(--color-border); font-size: var(--fs-xs); color: var(--color-fg-faint); font-family: var(--font-mono); }
`;
