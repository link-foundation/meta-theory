Require Import PeanoNat.
Require Import Coq.Init.Nat.
Require Import Vector.
Require Import List.
Require Import Coq.Init.Datatypes.
Import ListNotations.
Import VectorNotations.

(* Множество ссылок на вектора: L ⊆ ℕ₀ *)
Definition L := nat.

(* Значение L по умолчанию: ноль *)
Definition LDefault : L := 0.

(* Множество векторов ссылок длины n ∈ ℕ₀: Vn ⊆ Lⁿ *)
Definition Vn (n : nat) := t L n.

(* Значение Vn по умолчанию *)
Definition VnDefault (n : nat) : Vn n := Vector.const LDefault n.

(* Множество всех ассоциаций: A = L × Vn *)
Definition A (n : nat) := prod L (Vn n).

(* Ассоциативная сеть векторов длины n (или n-мерная ассоциативная сеть) из семейства функций {anetvⁿ : L → Vn} *)
Definition ANetVf (n : nat) := L -> Vn n.

(* Ассоциативная сеть векторов длины n (или n-мерная ассоциативная сеть) в виде последовательности *)
Definition ANetVl (n : nat) := list (Vn n).

(* Вложенные упорядоченные пары *)
Definition NP := list L.

(* Ассоциативная сеть вложенных упорядоченных пар: anetl : L → NP *)
Definition ANetLf := L -> NP.

(* Ассоциативная сеть вложенных упорядоченных пар в виде последовательности вложенных упорядоченных пар *)
Definition ANetLl := list NP.

(* Дуплет ссылок *)
Definition D := prod L L.

(* Значение D по умолчанию: пара из двух LDefault, используется для обозначения пустого дуплета *)
Definition DDefault : D := (LDefault, LDefault).

(* Ассоциативная сеть дуплетов (или двумерная ассоциативная сеть): anetd : L → L² *)
Definition ANetDf := L -> D.

(* Ассоциативная сеть дуплетов (или двумерная ассоциативная сеть) в виде последовательности дуплетов *)
Definition ANetDl := list D.
