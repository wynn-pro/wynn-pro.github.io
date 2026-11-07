// Sunbeam Garden levels. Each level is a little map made of letters:
//   > < ^ v   the sun, shining that way
//   / \       a mirror you can tap to turn
//   1 2       a stuck mirror (1 looks like /, 2 looks like \) that you can't turn
//   s z       a crystal: half the light goes straight on, half bounces (s like /, z like \). Tap to turn.
//   f         a flower that needs sunshine
//   w         a weed. Don't let the sun reach it!
//   #         a rock that blocks the light
//   .         grass
// Make your own: add a new { name, map } at the end. Every row must be the same length.
"use strict";
const LEVELS = [
  { name: "First Light", map: [
    ".....",
    "...f.",
    ".....",
    ">..\\.",
    ".....",
  ] },
  { name: "Round the Corner", map: [
    "......",
    ".f..\\.",
    "......",
    "......",
    ">...\\.",
    "......",
  ] },
  { name: "Flower Row", map: [
    ".......",
    ".\\f.f.f",
    ".......",
    "....../",
    ">\\.....",
  ] },
  { name: "Stepping Stones", map: [
    "f...#.",
    "......",
    ".#.\\..",
    "......",
    ">..2.\\",
    "......",
  ] },
  { name: "Zig Zag", map: [
    "#....f",
    ".\\..\\.",
    "......",
    ".\\..\\.",
    "......",
    ">/....",
  ] },
  { name: "Stuck Mirrors", map: [
    "..f....",
    ".......",
    "v..1..f",
    ".......",
    "\\..\\..2",
    ".......",
    "f..2..\\",
  ] },
  { name: "Mind the Weed", map: [
    ".w....",
    "......",
    ">.\\.\\f",
    "......",
    "..\\../",
    "...f..",
  ] },
  { name: "Weedy Patch", map: [
    "f..w..",
    "......",
    "\\../.w",
    "......",
    "/..\\.f",
    "^.....",
  ] },
  { name: "Long Way Round", map: [
    ".......",
    ".\\.w.\\.",
    ".......",
    ">/.#.\\f",
    ".......",
    ".\\...\\.",
    "...f...",
  ] },
  { name: "Crystal Clear", map: [
    "...f..",
    "......",
    ">..z.f",
    "......",
    "......",
    "......",
  ] },
  { name: "Two Ways", map: [
    "..f....",
    ".......",
    ".\\...\\.",
    ".......",
    ">.s...f",
    ".......",
    "..\\.f..",
  ] },
  { name: "Crystal Cross", map: [
    "...v...",
    "f.....f",
    "...s...",
    ".w...w.",
    "\\..\\..\\",
    ".......",
    "f..#..f",
  ] },
  { name: "Weeds Everywhere", map: [
    "w.f.w..",
    ".......",
    ">.z.\\.f",
    ".......",
    "w.\\.s.w",
    ".......",
    "..f.\\.f",
  ] },
  { name: "Hall of Mirrors", map: [
    "f.......",
    ".\\.\\..\\.",
    "...w....",
    ">s.\\.z.f",
    "........",
    ".\\.#.\\.w",
    "........",
    "f..\\..f.",
  ] },
  { name: "Grand Garden", map: [
    "f..w...f",
    ".\\..s..\\",
    "........",
    ">z..\\.s.",
    "........",
    ".\\.#...f",
    "w.......",
    "f..\\.w.\\",
  ] },
];
