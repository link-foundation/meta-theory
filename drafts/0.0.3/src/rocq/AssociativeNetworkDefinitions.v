Require Import PeanoNat.
Require Import Coq.Init.Nat.
Require Import Vector.
Require Import List.
Require Import Coq.Init.Datatypes.
Import ListNotations.
Import VectorNotations.

(* Ссылка (Reference) — уникальный идентификатор кортежа: L ⊆ ℕ₀ *)
Definition Reference := nat.

(* Значение Reference по умолчанию: ноль *)
Definition ReferenceDefault : Reference := 0.

(* Множество кортежей ссылок длины n ∈ ℕ₀: TupleOfReferences ⊆ Lⁿ *)
Definition TupleOfReferences (n : nat) := t Reference n.

(* Значение TupleOfReferences по умолчанию *)
Definition TupleOfReferencesDefault (n : nat) : TupleOfReferences n := Vector.const ReferenceDefault n.

(* Множество всех ассоциаций: Association = Reference × TupleOfReferences
   Association (связь) — это пара из ссылки и кортежа ссылок *)
Definition Association (n : nat) := prod Reference (TupleOfReferences n).

(* Ассоциативная сеть кортежей длины n (или n-мерная ассоциативная сеть) из семейства функций {anetvⁿ : Reference → TupleOfReferences} *)
Definition AssociativeNetworkTupleFunction (n : nat) := Reference -> TupleOfReferences n.

(* Ассоциативная сеть кортежей длины n (или n-мерная ассоциативная сеть) в виде последовательности *)
Definition AssociativeNetworkTupleList (n : nat) := list (TupleOfReferences n).

(* Список ссылок (ранее NestedPair — вложенные упорядоченные пары): ReferenceList ⊆ List(L) *)
Definition ReferenceList := list Reference.

(* Ассоциативная сеть списков ссылок: anetl : Reference → ReferenceList *)
Definition AssociativeNetworkReferenceListFunction := Reference -> ReferenceList.

(* Ассоциативная сеть списков ссылок в виде последовательности списков ссылок *)
Definition AssociativeNetworkReferenceListList := list ReferenceList.

(* Дуплет ссылок: упорядоченная пара (Reference, Reference).
   В нотации связей (https://github.com/link-foundation/links-notation):
   дуплет записывается как (id: from to), например (3: 1 2) *)
Definition Duplet := prod Reference Reference.

(* Значение Duplet по умолчанию: пара из двух ReferenceDefault, используется для обозначения пустого дуплета *)
Definition DupletDefault : Duplet := (ReferenceDefault, ReferenceDefault).

(* Ассоциативная сеть дуплетов (или двумерная ассоциативная сеть): anetd : Reference → Reference² *)
Definition AssociativeNetworkDupletFunction := Reference -> Duplet.

(* Ассоциативная сеть дуплетов (или двумерная ассоциативная сеть) в виде последовательности дуплетов *)
Definition AssociativeNetworkDupletList := list Duplet.
