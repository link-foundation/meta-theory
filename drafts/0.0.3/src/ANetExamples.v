Require Import PeanoNat.
Require Import Coq.Init.Nat.
Require Import Vector.
Require Import List.
Require Import Coq.Init.Datatypes.
Import ListNotations.
Import VectorNotations.
Require Import ANetDefs.
Require Import ANetConv.

(* Нотация записи списков *)
Notation "{ }" := (nil) (at level 0).
Notation "{ x , .. , y }" := (cons x .. (cons y nil) ..) (at level 0).

(* Трёхмерная ассоциативная сеть *)
Definition complexExampleNet : ANetVf 3 :=
  fun id => match id with
  | 0 => [0; 0; 0]
  | 1 => [1; 1; 2]
  | 2 => [2; 4; 0]
  | 3 => [3; 0; 5]
  | 4 => [4; 1; 1]
  | S _ => [0; 0; 0]
  end.

(* Вектора ссылок *)
Definition exampleTuple0 : Vn 0 := [].
Definition exampleTuple1 : Vn 1 := [0].
Definition exampleTuple4 : Vn 4 := [3; 2; 1; 0].

(* Преобразование векторов ссылок во вложенные упорядоченные пары (списки) *)
Definition nestedPair0 := VnToNP exampleTuple0.
Definition nestedPair1 := VnToNP exampleTuple1.
Definition nestedPair4 := VnToNP exampleTuple4.

Compute nestedPair0. (* Ожидается результат: { } *)
Compute nestedPair1. (* Ожидается результат: {0} *)
Compute nestedPair4. (* Ожидается результат: {3, 2, 1, 0} *)

(* Вычисление значений преобразованной функции трёхмерной ассоциативной сети *)
Compute (ANetVfToANetLf complexExampleNet) 0. (* Ожидается результат: {0, 0, 0} *)
Compute (ANetVfToANetLf complexExampleNet) 1. (* Ожидается результат: {1, 1, 2} *)
Compute (ANetVfToANetLf complexExampleNet) 2. (* Ожидается результат: {2, 4, 0} *)
Compute (ANetVfToANetLf complexExampleNet) 3. (* Ожидается результат: {3, 0, 5} *)
Compute (ANetVfToANetLf complexExampleNet) 4. (* Ожидается результат: {4, 1, 1} *)
Compute (ANetVfToANetLf complexExampleNet) 5. (* Ожидается результат: {0, 0, 0} *)

(* Ассоциативная сеть вложенных упорядоченных пар *)
Definition testPairsNet : ANetLf :=
  fun id => match id with
  | 0 => {5, 0, 8}
  | 1 => {7, 1, 2}
  | 2 => {2, 4, 5}
  | 3 => {3, 1, 5}
  | 4 => {4, 2, 1}
  | S _ => {0, 0, 0}
  end.

(* Преобразованная ассоциативная сеть вложенных УП в трёхмерную ассоциативную сеть (размерность должна совпадать) *)
Definition testTuplesNet : ANetVf 3 :=
  ANetLfToANetVf testPairsNet.

(* Вычисление значений преобразованной функции ассоциативной сети вложенных УП *)
Compute testTuplesNet 0. (* Ожидается результат: [5; 0; 8] *)
Compute testTuplesNet 1. (* Ожидается результат: [7; 1; 2] *)
Compute testTuplesNet 2. (* Ожидается результат: [2; 4; 5] *)
Compute testTuplesNet 3. (* Ожидается результат: [3; 1; 5] *)
Compute testTuplesNet 4. (* Ожидается результат: [4; 2; 1] *)
Compute testTuplesNet 5. (* Ожидается результат: [0; 0; 0] *)

(* Преобразование вложенных УП в ассоциативную сеть дуплетов *)
Compute NPToANetDl { 121, 21, 1343 }.
(* Должно вернуть: {(121, 1), (21, 2), (1343, 2)} *)

(* Добавление вложенных УП в ассоциативную сеть дуплетов *)
Compute AddNPToANetDl {(121, 1), (21, 2), (1343, 2)} {12, 23, 34}.
(* Ожидается результат: {(121, 1), (21, 2), (1343, 2), (12, 4), (23, 5), (34, 5)} *)

(* Преобразование ассоциативной сети дуплетов во вложенные УП *)
Compute ANetDlToNP {(121, 1), (21, 2), (1343, 2)}.
(* Ожидается результат: {121, 21, 1343} *)

Compute ANetDlToNP {(121, 1), (21, 2), (1343, 2), (12, 4), (23, 5), (34, 5)}.
(* Ожидается результат: {121, 21, 1343} *)

(* Чтение вложенных УП из ассоциативной сети дуплетов по индексу дуплета — начала вложенных УП *)
Compute ANetDl_readNP {(121, 1), (21, 2), (1343, 2), (12, 4), (23, 5), (34, 5)} 0.
(* Ожидается результат: {121, 21, 1343} *)

Compute ANetDl_readNP {(121, 1), (21, 2), (1343, 2), (12, 4), (23, 5), (34, 5)} 3.
(* Ожидается результат: {12, 23, 34} *)

(* Определяем ассоциативную сеть вложенных УП *)
Definition test_anetl := { {121, 21, 1343}, {12, 23}, {34}, {121, 21, 1343}, {12, 23}, {34} }.

(* Преобразованная ассоциативная сеть вложенных УП в ассоциативную сеть дуплетов *)
Definition test_anetd := ANetLlToANetDl test_anetl.

(* Вычисление преобразованной ассоциативной сети вложенных УП в ассоциативную сеть дуплетов *)
Compute test_anetd.
(* Ожидается результат:
 {(121, 1), (21, 2), (1343, 2),
  (12, 4), (23, 4),
  (34, 5),
  (121, 7), (21, 8), (1343, 8),
  (12, 10), (23, 10),
  (34, 11)} *)

(* Вычисление преобразования ассоциативной сети вложенных УП в ассоциативную сеть дуплетов и обратно в test_anetl *)
Compute ANetDlToANetLl test_anetd.
(* Ожидается результат:
  {{121, 21, 1343}, {12, 23}, {34}, {121, 21, 1343}, {12, 23}, {34}} *)

(* Вычисление смещения вложенных УП в ассоциативной сети дуплетов по их порядковому номеру *)
Compute ANetDl_offsetNP test_anetd 0. (* Ожидается результат: 0 *)
Compute ANetDl_offsetNP test_anetd 1. (* Ожидается результат: 3 *)
Compute ANetDl_offsetNP test_anetd 2. (* Ожидается результат: 5 *)
Compute ANetDl_offsetNP test_anetd 3. (* Ожидается результат: 6 *)
Compute ANetDl_offsetNP test_anetd 4. (* Ожидается результат: 9 *)
Compute ANetDl_offsetNP test_anetd 5. (* Ожидается результат: 11 *)
Compute ANetDl_offsetNP test_anetd 6. (* Ожидается результат: 12 *)
Compute ANetDl_offsetNP test_anetd 7. (* Ожидается результат: 12 *)

(* Определяем трёхмерную ассоциативную сеть как последовательность векторов длины 3 *)
Definition test_anetv : ANetVl 3 :=
  { [0; 0; 0], [1; 1; 2], [2; 4; 0], [3; 0; 5], [4; 1; 1], [0; 0; 0] }.

(* Преобразованная трёхмерная ассоциативная сеть в ассоциативную сеть дуплетов через ассоциативную сеть вложенных УП *)
Definition test_anetdl : ANetDl := ANetVlToANetDl test_anetv.

(* Вычисление трёхмерной ассоциативной сети преобразованной в ассоциативную сеть дуплетов через ассоциативную сеть вложенных УП *)
Compute test_anetdl.
(* Ожидается результат:
{ (0, 1), (0, 2), (0, 2),
  (1, 4), (1, 5), (2, 5),
  (2, 7), (4, 8), (0, 8),
  (3, 10), (0, 11), (5, 11),
  (4, 13), (1, 14), (1, 14),
  (0, 16), (0, 17), (0, 17)} *)

(* Преобразованная трёхмерная ассоциативная сеть в ассоциативную сеть дуплетов через ассоциативную сеть вложенных УП и обратно в трёхмерную ассоциативную сеть *)
Definition result_TuplesNet : ANetVl 3 :=
  ANetLlToANetVl (ANetDlToANetLl test_anetdl).

(* Итоговая проверка эквивалентности ассоциативных сетей *)
Compute result_TuplesNet.
(* Ожидается результат:
  { [0; 0; 0], [1; 1; 2], [2; 4; 0], [3; 0; 5], [4; 1; 1], [0; 0; 0] } *)
