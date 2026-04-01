Require Import PeanoNat.
Require Import Coq.Init.Nat.
Require Import Vector.
Require Import List.
Require Import Coq.Init.Datatypes.
Import ListNotations.
Import VectorNotations.

(* Ссылка (Reference) — уникальный идентификатор кортежа: R ⊆ ℕ₀ *)
Definition Reference := nat.

(* Значение Reference по умолчанию: ноль *)
Definition ReferenceDefault : Reference := 0.

(* Множество кортежей ссылок длины n ∈ ℕ₀: TupleOfReferences ⊆ Rⁿ *)
Definition TupleOfReferences (n : nat) := t Reference n.

(* Значение TupleOfReferences по умолчанию *)
Definition TupleOfReferencesDefault (n : nat) : TupleOfReferences n := Vector.const ReferenceDefault n.

(* Множество всех связей: Link = Reference × TupleOfReferences
   Link (связь) — это пара из ссылки и кортежа ссылок *)
Definition Link (n : nat) := prod Reference (TupleOfReferences n).

(* Сеть кортежей длины n (или n-мерная сеть) из семейства функций {Nⁿ : Reference → TupleOfReferences} *)
Definition NetworkTupleFunction (n : nat) := Reference -> TupleOfReferences n.

(* Сеть кортежей длины n (или n-мерная сеть) в виде последовательности *)
Definition NetworkTupleList (n : nat) := list (TupleOfReferences n).

(* Список ссылок: ReferenceList ⊆ List(R) *)
Definition ReferenceList := list Reference.

(* Сеть списков ссылок: N^{list} : Reference → ReferenceList *)
Definition NetworkReferenceListFunction := Reference -> ReferenceList.

(* Сеть списков ссылок в виде последовательности списков ссылок *)
Definition NetworkReferenceListList := list ReferenceList.

(* Дуплет ссылок: упорядоченная пара (Reference, Reference).
   В нотации связей (https://github.com/link-foundation/links-notation):
   дуплет записывается как (id: from to), например (3: 1 2) *)
Definition Duplet := prod Reference Reference.

(* Значение Duplet по умолчанию: пара из двух ReferenceDefault, используется для обозначения пустого дуплета *)
Definition DupletDefault : Duplet := (ReferenceDefault, ReferenceDefault).

(* Сеть дуплетов (или двумерная сеть): N² : Reference → Reference² *)
Definition NetworkDupletFunction := Reference -> Duplet.

(* Сеть дуплетов (или двумерная сеть) в виде последовательности дуплетов *)
Definition NetworkDupletList := list Duplet.
